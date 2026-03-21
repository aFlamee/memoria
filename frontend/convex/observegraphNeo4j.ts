'use node';

import neo4j, { type Session } from 'neo4j-driver';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

type ProjectionResult =
	| { status: 'skipped'; reason: string }
	| {
			status: 'projected';
			counts: {
				instances: number;
				sessions: number;
				tasks: number;
				actions: number;
				taskTemplates: number;
				stepNodes: number;
				stepEdges: number;
			};
	  };

async function ensureConstraints(session: Session) {
	await session.run(
		'CREATE CONSTRAINT observegraph_instance_id IF NOT EXISTS FOR (n:Instance) REQUIRE n.instanceId IS UNIQUE'
	);
	await session.run(
		'CREATE CONSTRAINT observegraph_session_id IF NOT EXISTS FOR (n:Session) REQUIRE n.sessionId IS UNIQUE'
	);
	await session.run(
		'CREATE CONSTRAINT observegraph_task_id IF NOT EXISTS FOR (n:Task) REQUIRE n.taskId IS UNIQUE'
	);
	await session.run(
		'CREATE CONSTRAINT observegraph_action_id IF NOT EXISTS FOR (n:Action) REQUIRE n.actionId IS UNIQUE'
	);
	await session.run(
		'CREATE CONSTRAINT observegraph_template_id IF NOT EXISTS FOR (n:TaskTemplate) REQUIRE n.templateId IS UNIQUE'
	);
	await session.run(
		'CREATE CONSTRAINT observegraph_step_id IF NOT EXISTS FOR (n:StepNode) REQUIRE n.stepId IS UNIQUE'
	);
}

export const projectAll = internalAction({
	args: {},
	handler: async (ctx): Promise<ProjectionResult> => {
		const payload = await ctx.runQuery(internal.observegraph.neo4jProjection, {});
		const username = process.env.NEO4J_USERNAME ?? 'neo4j';
		const password = process.env.NEO4J_PASSWORD;
		const boltPort = process.env.NEO4J_BOLT_PORT ?? '7687';
		if (!password) {
			return { status: 'skipped', reason: 'NEO4J_PASSWORD is not configured' };
		}

		const driver = neo4j.driver(
			`bolt://127.0.0.1:${boltPort}`,
			neo4j.auth.basic(username, password)
		);
		const session = driver.session();

		try {
			await ensureConstraints(session);
			await session.run('MATCH (n:ObserveGraph) DETACH DELETE n');
			await session.run(
				`UNWIND $rows AS row
				MERGE (n:ObserveGraph:Instance {instanceId: row.instanceId})
				SET n += row`,
				{ rows: payload.instances }
			);
			await session.run(
				`UNWIND $rows AS row
				MERGE (n:ObserveGraph:Session {sessionId: row.sessionId})
				SET n += row`,
				{ rows: payload.sessions }
			);
			await session.run(
				`UNWIND $rows AS row
				MERGE (n:ObserveGraph:Task {taskId: row.taskId})
				SET n += row`,
				{ rows: payload.tasks }
			);
			await session.run(
				`UNWIND $rows AS row
				MERGE (n:ObserveGraph:Action {actionId: row.actionId})
				SET n += row`,
				{ rows: payload.actions }
			);
			await session.run(
				`UNWIND $rows AS row
				MERGE (n:ObserveGraph:TaskTemplate {templateId: row.templateId})
				SET n += row`,
				{ rows: payload.taskTemplates }
			);
			await session.run(
				`UNWIND $rows AS row
				MERGE (n:ObserveGraph:StepNode {stepId: row.stepId})
				SET n += row`,
				{ rows: payload.stepNodes }
			);
			await session.run(
				`UNWIND $rows AS row
				MATCH (i:Instance {instanceId: row.instanceId})
				MATCH (s:Session {sessionId: row.sessionId})
				MERGE (i)-[:HAS_SESSION]->(s)`,
				{ rows: payload.sessions }
			);
			await session.run(
				`UNWIND $rows AS row
				MATCH (s:Session {sessionId: row.sessionId})
				MATCH (t:Task {taskId: row.taskId})
				MERGE (s)-[:HAS_TASK]->(t)`,
				{ rows: payload.tasks }
			);
			await session.run(
				`UNWIND $rows AS row
				MATCH (t:Task {taskId: row.taskId})
				MATCH (a:Action {actionId: row.actionId})
				MERGE (t)-[:PERFORMED {sequence: row.sequence, runId: row.runId}]->(a)`,
				{ rows: payload.actions }
			);
			await session.run(
				`UNWIND $rows AS row
				MATCH (t:Task {taskId: row.taskId})
				MATCH (tmpl:TaskTemplate {templateId: row.templateId})
				MERGE (t)-[:RUN_OF {runId: row.runId}]->(tmpl)`,
				{ rows: payload.tasks }
			);
			await session.run(
				`UNWIND $rows AS row
				MATCH (a:Action {actionId: row.actionId})
				MATCH (sn:StepNode {stepId: row.stepId})
				MERGE (a)-[:INSTANCE_OF {runId: row.runId, taskId: row.taskId}]->(sn)`,
				{ rows: payload.actions }
			);
			await session.run(
				`UNWIND $rows AS row
				MATCH (s1:StepNode {stepId: row.fromStepId})
				MATCH (s2:StepNode {stepId: row.toStepId})
				MERGE (s1)-[rel:STEP_SEQUENCE {edgeId: row.edgeId}]->(s2)
				SET rel += row`,
				{ rows: payload.stepEdges }
			);

			return {
				status: 'projected',
				counts: {
					instances: payload.instances.length,
					sessions: payload.sessions.length,
					tasks: payload.tasks.length,
					actions: payload.actions.length,
					taskTemplates: payload.taskTemplates.length,
					stepNodes: payload.stepNodes.length,
					stepEdges: payload.stepEdges.length
				}
			};
		} finally {
			await session.close();
			await driver.close();
		}
	}
});
