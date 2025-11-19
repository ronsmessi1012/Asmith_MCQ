from pydantic import BaseModel
from datetime import datetime


class MaterialResponse(BaseModel):
    id: int
    title: str
    filename: str
    filepath: str
    uploaded_at: datetime

    class Config:
        orm_mode = True
