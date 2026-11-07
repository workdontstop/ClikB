import modal


app = modal.App("clikb-smoke-test")


@app.function()
def check_connection() -> dict[str, str]:
    return {
        "status": "ok",
        "message": "ClikB is connected to Modal.",
    }


@app.local_entrypoint()
def main() -> None:
    result = check_connection.remote()
    print(result)
