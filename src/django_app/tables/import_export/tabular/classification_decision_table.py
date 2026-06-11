import csv
import io


RULE_COLUMNS = [
    "#",
    "Rule Name",
    "Section",
    "Route Code",
    "Condition",
    "AI Prompt",
    "AI Model",
    "Saves Result To",
    "Action",
    "Field Conditions",
    "Field Actions",
    "Continue After Match",
    "Next Step",
]

LLM_CONFIG_COLUMNS = ["Configuration Name", "Model", "Temperature", "Max Tokens"]


def _yes_no(value) -> str:
    return "Yes" if value else "No"


def _format_mapping(mapping) -> str:
    if not mapping:
        return ""
    return "\n".join(f"{key}: {value}" for key, value in mapping.items())


def _llm_config_label(config) -> str:
    if config is None:
        return ""
    model_name = config.model.name if config.model else ""
    if model_name and model_name != config.custom_name:
        return f"{config.custom_name} ({model_name})"
    return config.custom_name


def _node_label(node_id, cache: dict) -> str:
    from tables.models.base_models import BaseGlobalNode

    if not node_id:
        return ""
    if node_id not in cache:
        target = BaseGlobalNode.find_globally(node_id)
        cache[node_id] = getattr(target, "node_name", "") or f"node #{node_id}"
    return cache[node_id]


def _collect_llm_configs(node, groups) -> list:
    configs = {}
    if node.default_llm_config:
        configs[node.default_llm_config_id] = node.default_llm_config
    for group in groups:
        if group.prompt and group.prompt.llm_config:
            configs[group.prompt.llm_config_id] = group.prompt.llm_config
    return list(configs.values())


def rule_row(number: int, group, node_names: dict) -> list:
    prompt = group.prompt
    return [
        number,
        group.group_name,
        group.section or "",
        group.route_code or "",
        group.expression or "",
        prompt.prompt_text if prompt else "",
        _llm_config_label(prompt.llm_config) if prompt else "",
        prompt.result_variable if prompt else "",
        group.manipulation or "",
        _format_mapping(group.field_expressions),
        _format_mapping(group.field_manipulations),
        _yes_no(group.continue_flag),
        _node_label(group.next_node_id, node_names),
    ]


def export_condition_groups_csv(node) -> io.StringIO:
    groups = list(
        node.condition_groups.select_related("prompt__llm_config__model").order_by(
            "order"
        )
    )
    node_names: dict = {}

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["CLASSIFICATION DECISION TABLE"])
    writer.writerow(["Node Name", node.node_name])
    writer.writerow(["Default AI Model", _llm_config_label(node.default_llm_config)])
    writer.writerow(["Pre-processing Script", _yes_no(node.pre_python_code_id)])
    writer.writerow(["Post-processing Script", _yes_no(node.post_python_code_id)])
    writer.writerow(
        ["Default Next Step", _node_label(node.default_next_node_id, node_names)]
    )
    writer.writerow(
        ["On Error Go To", _node_label(node.next_error_node_id, node_names)]
    )
    writer.writerow(["Number of Rules", len(groups)])
    writer.writerow([])

    llm_configs = _collect_llm_configs(node, groups)
    if llm_configs:
        writer.writerow(["AI MODELS USED"])
        writer.writerow(LLM_CONFIG_COLUMNS)
        for config in llm_configs:
            writer.writerow(
                [
                    config.custom_name,
                    config.model.name if config.model else "",
                    config.temperature,
                    config.max_tokens,
                ]
            )
        writer.writerow([])

    writer.writerow(["DECISION RULES"])
    writer.writerow(RULE_COLUMNS)
    for number, group in enumerate(groups, start=1):
        writer.writerow(rule_row(number, group, node_names))

    return buf
