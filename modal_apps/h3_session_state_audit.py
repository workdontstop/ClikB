"""CPU-only audit of persisted H3 session call IDs."""

import modal


app = modal.App("clikb-h3-session-state-audit")
states = modal.Dict.from_name("clikb-h3-ref2va-user-sessions", create_if_missing=False)


@app.function(cpu=0.25, memory=256, timeout=30)
def inspect_states() -> list[tuple[str, object]]:
    return list(states.items())


@app.local_entrypoint()
def main() -> None:
    for key, value in inspect_states.remote():
        print(key, value)
