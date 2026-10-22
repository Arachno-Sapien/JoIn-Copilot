from pathlib import Path
import re
import yaml

from app.llm.prompts import SYSTEM_SECURITY_PREAMBLE, render_prompt_template

PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "app" / "prompts"


def test_every_prompt_template_renders_untrusted_fields_inside_delimiters():
    prompt_files = list(PROMPTS_DIR.glob("*.v*.md"))
    assert len(prompt_files) >= 2, f"Expected versioned prompt files in {PROMPTS_DIR}, found: {prompt_files}"

    injection_marker = "TEST_INJECTION_ATTACK_STRING_IGNORE_PREVIOUS_INSTRUCTIONS"

    for prompt_path in prompt_files:
        content = prompt_path.read_text(encoding="utf-8")
        assert content.startswith("---"), f"Missing YAML frontmatter in {prompt_path.name}"
        parts = content.split("---", 2)
        frontmatter = yaml.safe_load(parts[1]) or {}
        untrusted_fields = frontmatter.get("untrusted", [])

        # Each untrusted field must be declared
        assert isinstance(untrusted_fields, list), f"untrusted must be a list in {prompt_path.name}"

        # Find all placeholders in the template: {{ name }}
        placeholders = set(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", parts[2]))

        # Prepare dummy inputs with injection marker for untrusted fields
        inputs = {}
        for p in placeholders:
            if p in untrusted_fields:
                inputs[p] = f"Prefix text. {injection_marker} . Suffix text."
            else:
                inputs[p] = f"SafeInput_{p}"

        template_name = prompt_path.name
        messages = render_prompt_template(template_name, inputs)
        combined_text = "\n".join(m["content"] for m in messages)

        # Check preamble
        assert SYSTEM_SECURITY_PREAMBLE in combined_text

        # Check that for each untrusted field, the injection marker is strictly enclosed in <untrusted_data>
        if untrusted_fields:
            assert injection_marker in combined_text
            # Strip all <untrusted_data>...</untrusted_data> blocks and assert marker does NOT appear outside
            outside_delimiters = re.sub(r"<untrusted_data>.*?</untrusted_data>", "", combined_text, flags=re.DOTALL)
            assert injection_marker not in outside_delimiters, (
                f"Injection marker leaked outside <untrusted_data> in template {prompt_path.name}"
            )
