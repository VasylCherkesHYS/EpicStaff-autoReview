from tables.models.agent_models.surface_models import ResolvedSurface, Surface


class SurfaceService:
    @staticmethod
    def combine(*surfaces: Surface) -> ResolvedSurface:
        """
        Resolve each surface (walking its own parent chain) then
        union the results. additional_instructions concatenated in
        argument order, separated by '\\n\\n'. Resources deduped by pk.
        """
        resolved = [surface.resolve() for surface in surfaces]

        instructions_parts = [
            r.additional_instructions for r in resolved if r.additional_instructions
        ]

        def _union_by_pk(lists):
            seen: dict[int, object] = {}

            for items in lists:
                for obj in items:
                    if obj.pk not in seen:
                        seen[obj.pk] = obj

            return list(seen.values())

        return ResolvedSurface(
            additional_instructions="\n\n".join(instructions_parts),
            tool_configs=_union_by_pk(r.tool_configs for r in resolved),
            python_code_tool_configs=_union_by_pk(
                r.python_code_tool_configs for r in resolved
            ),
            mcp_tools=_union_by_pk(r.mcp_tools for r in resolved),
            knowledge_collections=_union_by_pk(
                r.knowledge_collections for r in resolved
            ),
            storage_files=_union_by_pk(r.storage_files for r in resolved),
        )
