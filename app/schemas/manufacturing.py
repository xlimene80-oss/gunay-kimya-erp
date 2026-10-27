import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.manufacturing import ProductionStatus
from app.schemas.inventory import ItemResponse

# ---------------------------------------------------------
# Recipe Ingredient Schemas
# ---------------------------------------------------------
class RecipeIngredientBase(BaseModel):
    raw_material_item_id: int = Field(..., description="Foreign key to raw chemical item")
    required_quantity: Decimal = Field(..., gt=Decimal("0.000"), description="Required quantity for recipe base amount")

class RecipeIngredientCreate(RecipeIngredientBase):
    pass

class RecipeIngredientUpdate(BaseModel):
    raw_material_item_id: Optional[int] = None
    required_quantity: Optional[Decimal] = Field(default=None, gt=Decimal("0.000"))

class RecipeIngredientResponse(RecipeIngredientBase):
    id: int
    recipe_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    raw_material: Optional[ItemResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Recipe (Bill of Materials) Schemas
# ---------------------------------------------------------
class RecipeBase(BaseModel):
    name: str = Field(..., max_length=200, description="Name of the chemical formulation")
    description: Optional[str] = Field(default=None, description="Detailed instructions, mixing order, pH target")
    output_item_id: int = Field(..., description="Foreign key to produced chemical item")
    base_quantity: Decimal = Field(default=Decimal("1000.000"), gt=Decimal("0.000"), description="Base formulation batch volume/weight")

class RecipeCreate(RecipeBase):
    ingredients: List[RecipeIngredientCreate] = Field(..., min_length=1, description="List of raw chemical ingredients")

class RecipeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    output_item_id: Optional[int] = None
    base_quantity: Optional[Decimal] = Field(default=None, gt=Decimal("0.000"))
    ingredients: Optional[List[RecipeIngredientCreate]] = None

class RecipeResponse(RecipeBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    ingredients: List[RecipeIngredientResponse] = []
    output_item: Optional[ItemResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Production Order Schemas
# ---------------------------------------------------------
class ProductionOrderBase(BaseModel):
    order_number: str = Field(..., max_length=60, description="Unique production batch order number")
    recipe_id: int = Field(..., description="Foreign key to formulation recipe")
    target_quantity: Decimal = Field(..., gt=Decimal("0.000"), description="Target quantity to manufacture")
    status: ProductionStatus = Field(default=ProductionStatus.PENDING, description="Order lifecycle status")

class ProductionOrderCreate(BaseModel):
    order_number: str = Field(..., max_length=60, description="Unique production batch order number")
    recipe_id: int = Field(..., description="Foreign key to formulation recipe")
    target_quantity: Decimal = Field(..., gt=Decimal("0.000"), description="Target quantity to manufacture")
    status: Optional[ProductionStatus] = Field(default=ProductionStatus.PENDING)

class ProductionOrderUpdate(BaseModel):
    target_quantity: Optional[Decimal] = Field(default=None, gt=Decimal("0.000"))
    status: Optional[ProductionStatus] = None

class ProductionOrderResponse(ProductionOrderBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    recipe: Optional[RecipeResponse] = None

    model_config = ConfigDict(from_attributes=True)
