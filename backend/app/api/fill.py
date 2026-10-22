from fastapi import APIRouter

from app.schemas.fill import MapFieldsRequest, MapFieldsResponse
from app.services.fieldmap.mapper import map_form_fields

router = APIRouter(prefix="/fill", tags=["fill"])


@router.post("/map-fields", response_model=MapFieldsResponse)
async def map_fields(request: MapFieldsRequest) -> MapFieldsResponse:
    mappings = await map_form_fields(
        profile=request.profile,
        fields=request.fields,
    )
    return MapFieldsResponse(mappings=mappings)
