from fastapi import HTTPException

from app.convex_client import ConvexRequestError


def raise_as_http(error: ConvexRequestError) -> None:
    raise HTTPException(status_code=error.status_code, detail=error.detail) from error
