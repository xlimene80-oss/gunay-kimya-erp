import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models import Base, TimestampMixin

class CariNote(Base, TimestampMixin):
    """
    CRM customer notes and visit/call interaction history tied to CariAccount.
    """
    __tablename__ = "crm_cari_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cari_id: Mapped[int] = mapped_column(
        ForeignKey("cari_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("auth_users.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    cari: Mapped["CariAccount"] = relationship("CariAccount", back_populates="crm_notes")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
