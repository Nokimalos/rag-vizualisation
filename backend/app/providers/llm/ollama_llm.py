from collections.abc import AsyncGenerator
from typing import Any

import ollama

from app.providers.llm.base import LLMProvider


class OllamaLLMProvider(LLMProvider):
    def __init__(self, model: str = "llama3.1", base_url: str = "http://localhost:11434") -> None:
        self.model = model
        self.client = ollama.AsyncClient(host=base_url)

    def name(self) -> str:
        return "ollama"

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        messages: list[dict[str, str]] = []
        if system_prompt is not None:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat(
            model=self.model,
            messages=messages,
            options={"temperature": temperature, "num_predict": max_tokens},
        )

        prompt_tokens = response.get("prompt_eval_count", 0)
        completion_tokens = response.get("eval_count", 0)

        return {
            "content": response["message"]["content"],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        messages: list[dict[str, str]] = []
        if system_prompt is not None:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self.client.chat(
            model=self.model,
            messages=messages,
            stream=True,
            options={"temperature": temperature, "num_predict": max_tokens},
        )
        async for chunk in stream:
            yield chunk["message"]["content"]
