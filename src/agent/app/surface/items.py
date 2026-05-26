"""
Typed surface item models: the discriminated union that represents what is
available to an agent during a run.

Each concrete item type carries a ``Literal`` ``type`` field that Pydantic
uses as the discriminator key when deserialising the ``surface_items`` list
in ``AgentRequest``.

How the discriminator works
---------------------------
``SurfaceItem`` is an ``Annotated[Union[...], Field(discriminator="type")]``.
Pydantic reads the ``"type"`` key from the incoming dict and selects the
matching subclass.  To add a new surface item type:

1. Define a new frozen ``BaseModel`` subclass with
   ``type: Literal["<new_type>"] = "<new_type>"`` and any additional fields.
2. Add it to the ``Union`` inside ``SurfaceItem``.
3. Implement a matching ``ItemResolver`` and register it with
   ``SurfaceResolver``.

No changes to ``SurfaceResolver``'s core loop are required.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class ToolItem(BaseModel):
    """Surface item representing a named callable tool.

    ``name`` identifies the tool in the tool registry / execution backend.
    ``metadata`` carries provider-specific configuration (endpoint, auth
    hints, etc.) and is opaque to the resolver core.
    """

    model_config = ConfigDict(frozen=True)

    type: Literal["tool"] = "tool"
    name: str
    metadata: dict = Field(default_factory=dict)


class RAGItem(BaseModel):
    """Surface item representing a RAG knowledge collection.

    The resolver for this type retrieves relevant snippets and produces a
    ``ContextAttachment`` rather than a callable tool.  ``collection_ref``
    identifies the collection in the knowledge service.

    Concrete resolver implementation is a follow-up plan — see plan
    §'What is NOT in this plan'.
    """

    model_config = ConfigDict(frozen=True)

    type: Literal["rag"] = "rag"
    collection_ref: str
    metadata: dict = Field(default_factory=dict)


class S3Item(BaseModel):
    """Surface item representing an S3-hosted file or prefix.

    The resolver for this type may expose the content as a context
    attachment or as a file-access tool depending on configuration.
    ``path`` is an S3 URI or a relative path within the configured bucket.

    Concrete resolver implementation is a follow-up plan — see plan
    §'What is NOT in this plan'.
    """

    model_config = ConfigDict(frozen=True)

    type: Literal["s3"] = "s3"
    path: str
    metadata: dict = Field(default_factory=dict)


SurfaceItem = Annotated[
    Union[ToolItem, RAGItem, S3Item],
    Field(discriminator="type"),
]
