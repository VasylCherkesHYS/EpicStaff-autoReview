from graphrag.prompts.query.basic_search_system_prompt import BASIC_SEARCH_SYSTEM_PROMPT
from graphrag.prompts.query.local_search_system_prompt import LOCAL_SEARCH_SYSTEM_PROMPT
from graphrag.prompts.query.drift_search_system_prompt import (
    DRIFT_LOCAL_SYSTEM_PROMPT,
    DRIFT_REDUCE_PROMPT,
)
from graphrag.prompts.query.global_search_map_system_prompt import MAP_SYSTEM_PROMPT
from graphrag.prompts.query.global_search_reduce_system_prompt import (
    REDUCE_SYSTEM_PROMPT,
)

_DATA_GROUNDING_RULES = """

---Data Grounding Rules---

Base your response only on the information found in the provided data tables.
Do not supplement answers with general knowledge or training data.
If the data tables do not contain information that directly answers the question,
but contain something related or partially matching, highlight what is available
and clarify how it differs from what was asked.
If the data tables contain no relevant information at all, let the user know
that the available documents do not cover this topic.

---End of Data Grounding Rules---"""

_USER_PROMPT_WRAPPER = """

---Additional Instructions---

The following instructions are provided by the user and must be applied
in addition to the role, goal, and data grounding rules described above.
Do not override or ignore the data grounding rules.

{user_prompt}

---End of Additional Instructions---"""

# Permission to step outside the index. Applied ONLY to the global-search reduce
# stage (mirrors where upstream GlobalSearch appended its general-knowledge
# instruction) and ONLY when the user supplies a knowledge prompt. When present it
# replaces the strict data-grounding rules for that stage; otherwise the reduce
# stage stays grounded like every other stage.
_GENERAL_KNOWLEDGE_RULES = """

---General Knowledge Allowance---

In addition to the information in the provided data tables, you may use your own
general knowledge to answer the question when the data is insufficient or only
partially relevant. Clearly mark any statement that is not supported by the provided
data as general knowledge, for example: "[General Knowledge]". Always prefer the
provided data when it is relevant, and never contradict it.

The following instructions from the user describe how general knowledge should be used:

{knowledge_prompt}

---End of General Knowledge Allowance---"""

# The vendored drift local-stage prompt hardcodes "intermediate_answer ... exactly
# 2000 characters long". That intermediate answer feeds the drift reduce stage, so a
# fixed cap would truncate information before aggregation. We override the constraint
# here instead of editing the vendored prompt.
_DRIFT_LENGTH_OVERRIDE = """

---Response Length Override---

Disregard any fixed character-count requirement stated above for the intermediate_answer
(e.g. "exactly 2000 characters long"). Instead, make the intermediate_answer as complete
as the available data allows, matching the level of detail of the community summaries.
Do not artificially truncate or pad it to a fixed length.

---End of Response Length Override---"""


def _build_prompt(base_prompt: str, user_prompt: str | None = None) -> str:
    prompt = base_prompt + _DATA_GROUNDING_RULES
    if user_prompt:
        prompt += _USER_PROMPT_WRAPPER.format(user_prompt=user_prompt)
    return prompt


def build_basic_search_prompt(user_prompt: str | None = None) -> str:
    return _build_prompt(BASIC_SEARCH_SYSTEM_PROMPT, user_prompt)


def build_local_search_prompt(user_prompt: str | None = None) -> str:
    return _build_prompt(LOCAL_SEARCH_SYSTEM_PROMPT, user_prompt)


def build_drift_search_prompt(user_prompt: str | None = None) -> str:
    prompt = DRIFT_LOCAL_SYSTEM_PROMPT + _DATA_GROUNDING_RULES + _DRIFT_LENGTH_OVERRIDE
    if user_prompt:
        prompt += _USER_PROMPT_WRAPPER.format(user_prompt=user_prompt)
    return prompt


def build_drift_search_reduce_prompt(user_prompt: str | None = None) -> str:
    return _build_prompt(DRIFT_REDUCE_PROMPT, user_prompt)


def build_global_search_map_prompt(user_prompt: str | None = None) -> str:
    return _build_prompt(MAP_SYSTEM_PROMPT, user_prompt)


def build_global_search_reduce_prompt(
    user_prompt: str | None = None,
    knowledge_prompt: str | None = None,
) -> str:
    """Build the global-search reduce-stage system prompt.

    The map stage always stays strictly grounded in the index. The reduce stage is
    the only place where general knowledge may be permitted, matching upstream
    GlobalSearch behavior: when ``knowledge_prompt`` is provided the strict grounding
    rules are replaced by an explicit general-knowledge allowance; otherwise the
    reduce stage remains grounded.
    """
    if knowledge_prompt:
        prompt = REDUCE_SYSTEM_PROMPT + _GENERAL_KNOWLEDGE_RULES.format(
            knowledge_prompt=knowledge_prompt
        )
    else:
        prompt = REDUCE_SYSTEM_PROMPT + _DATA_GROUNDING_RULES
    if user_prompt:
        prompt += _USER_PROMPT_WRAPPER.format(user_prompt=user_prompt)
    return prompt
