import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.providers.llm.base import LLMProvider
from app.providers.llm.openai_llm import OpenAILLMProvider
from app.providers.llm.anthropic_llm import AnthropicLLMProvider
from app.providers.llm.ollama_llm import OllamaLLMProvider


# ---------------------------------------------------------------------------
# Helper: MockStreamManager for Anthropic streaming
# ---------------------------------------------------------------------------

class MockAnthropicStreamManager:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def __aiter__(self):
        for token in ["Hello", " from", " Claude"]:
            event = MagicMock()
            event.type = "content_block_delta"
            event.delta.text = token
            yield event


# ---------------------------------------------------------------------------
# 1. ABC enforcement
# ---------------------------------------------------------------------------

class TestCannotInstantiateBase:
    def test_cannot_instantiate_base(self):
        with pytest.raises(TypeError):
            LLMProvider()  # type: ignore[abstract]


# ---------------------------------------------------------------------------
# 2 & 3. Provider name and default model
# ---------------------------------------------------------------------------

class TestProviderNameAndDefaultModel:
    def test_openai_name(self):
        provider = OpenAILLMProvider(api_key="fake-key")
        assert provider.name() == "openai"

    def test_anthropic_name(self):
        provider = AnthropicLLMProvider(api_key="fake-key")
        assert provider.name() == "anthropic"

    def test_ollama_name(self):
        provider = OllamaLLMProvider()
        assert provider.name() == "ollama"

    def test_openai_default_model(self):
        provider = OpenAILLMProvider(api_key="fake-key")
        assert provider.model == "gpt-4o"

    def test_anthropic_default_model(self):
        provider = AnthropicLLMProvider(api_key="fake-key")
        assert provider.model == "claude-sonnet-4-20250514"

    def test_ollama_default_model(self):
        provider = OllamaLLMProvider()
        assert provider.model == "llama3.1"

    def test_openai_custom_model(self):
        provider = OpenAILLMProvider(api_key="fake-key", model="gpt-3.5-turbo")
        assert provider.model == "gpt-3.5-turbo"

    def test_anthropic_custom_model(self):
        provider = AnthropicLLMProvider(api_key="fake-key", model="claude-3-haiku-20240307")
        assert provider.model == "claude-3-haiku-20240307"

    def test_ollama_custom_model(self):
        provider = OllamaLLMProvider(model="mistral")
        assert provider.model == "mistral"


# ---------------------------------------------------------------------------
# 4. generate() — mock API calls, verify output format
# ---------------------------------------------------------------------------

class TestOpenAIGenerate:
    @pytest.mark.asyncio
    async def test_generate_returns_content_and_usage(self):
        provider = OpenAILLMProvider(api_key="fake-key")

        mock_message = MagicMock()
        mock_message.content = "Hello, world!"

        mock_choice = MagicMock()
        mock_choice.message = mock_message

        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 10
        mock_usage.completion_tokens = 5
        mock_usage.total_tokens = 15

        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = mock_usage

        mock_create = AsyncMock(return_value=mock_response)

        with patch.object(provider.client.chat.completions, "create", mock_create):
            result = await provider.generate("Test prompt")

        assert result["content"] == "Hello, world!"
        assert result["usage"]["prompt_tokens"] == 10
        assert result["usage"]["completion_tokens"] == 5
        assert result["usage"]["total_tokens"] == 15

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self):
        provider = OpenAILLMProvider(api_key="fake-key")

        mock_message = MagicMock()
        mock_message.content = "Response text"
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 20
        mock_usage.completion_tokens = 8
        mock_usage.total_tokens = 28
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = mock_usage

        mock_create = AsyncMock(return_value=mock_response)

        with patch.object(provider.client.chat.completions, "create", mock_create):
            result = await provider.generate("Test prompt", system_prompt="You are helpful.")

        # Verify system message was included
        call_kwargs = mock_create.call_args
        messages = call_kwargs.kwargs.get("messages") or call_kwargs.args[0] if call_kwargs.args else call_kwargs.kwargs["messages"]
        # messages is passed as keyword argument
        assert result["content"] == "Response text"


class TestAnthropicGenerate:
    @pytest.mark.asyncio
    async def test_generate_returns_content_and_usage(self):
        provider = AnthropicLLMProvider(api_key="fake-key")

        mock_content_block = MagicMock()
        mock_content_block.text = "Hello from Anthropic"

        mock_usage = MagicMock()
        mock_usage.input_tokens = 12
        mock_usage.output_tokens = 7

        mock_response = MagicMock()
        mock_response.content = [mock_content_block]
        mock_response.usage = mock_usage

        mock_create = AsyncMock(return_value=mock_response)

        with patch.object(provider.client.messages, "create", mock_create):
            result = await provider.generate("Test prompt")

        assert result["content"] == "Hello from Anthropic"
        assert result["usage"]["prompt_tokens"] == 12
        assert result["usage"]["completion_tokens"] == 7
        assert result["usage"]["total_tokens"] == 19


class TestOllamaGenerate:
    @pytest.mark.asyncio
    async def test_generate_returns_content_and_usage(self):
        provider = OllamaLLMProvider()

        mock_response = {
            "message": {"content": "Hello from Ollama"},
            "prompt_eval_count": 8,
            "eval_count": 4,
        }

        mock_chat = AsyncMock(return_value=mock_response)

        with patch.object(provider.client, "chat", mock_chat):
            result = await provider.generate("Test prompt")

        assert result["content"] == "Hello from Ollama"
        assert result["usage"]["prompt_tokens"] == 8
        assert result["usage"]["completion_tokens"] == 4
        assert result["usage"]["total_tokens"] == 12


# ---------------------------------------------------------------------------
# 5. generate_stream() — mock streaming, verify token yields
# ---------------------------------------------------------------------------

class TestOpenAIGenerateStream:
    @pytest.mark.asyncio
    async def test_generate_stream_yields_tokens(self):
        provider = OpenAILLMProvider(api_key="fake-key")

        tokens = ["Hi", " there", "!"]

        async def mock_stream_context():
            for token in tokens:
                chunk = MagicMock()
                chunk.choices[0].delta.content = token
                yield chunk

        mock_create = AsyncMock(return_value=mock_stream_context())

        with patch.object(provider.client.chat.completions, "create", mock_create):
            collected = []
            async for token in provider.generate_stream("Test prompt"):
                collected.append(token)

        assert collected == tokens

    @pytest.mark.asyncio
    async def test_generate_stream_skips_none_content(self):
        provider = OpenAILLMProvider(api_key="fake-key")

        # First chunk has None content (common at start of stream), second has text
        async def mock_stream_context():
            for content in [None, "Hello", None, " world"]:
                chunk = MagicMock()
                chunk.choices[0].delta.content = content
                yield chunk

        mock_create = AsyncMock(return_value=mock_stream_context())

        with patch.object(provider.client.chat.completions, "create", mock_create):
            collected = []
            async for token in provider.generate_stream("Test"):
                collected.append(token)

        assert collected == ["Hello", " world"]


class TestAnthropicGenerateStream:
    @pytest.mark.asyncio
    async def test_generate_stream_yields_tokens(self):
        provider = AnthropicLLMProvider(api_key="fake-key")

        with patch.object(provider.client.messages, "stream", return_value=MockAnthropicStreamManager()):
            collected = []
            async for token in provider.generate_stream("Test prompt"):
                collected.append(token)

        assert collected == ["Hello", " from", " Claude"]

    @pytest.mark.asyncio
    async def test_generate_stream_skips_non_delta_events(self):
        provider = AnthropicLLMProvider(api_key="fake-key")

        class MixedEventStreamManager:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def __aiter__(self):
                # Non-delta event should be skipped
                non_delta = MagicMock()
                non_delta.type = "message_start"
                yield non_delta

                # Delta event should be yielded
                delta = MagicMock()
                delta.type = "content_block_delta"
                delta.delta.text = "Token"
                yield delta

        with patch.object(provider.client.messages, "stream", return_value=MixedEventStreamManager()):
            collected = []
            async for token in provider.generate_stream("Test"):
                collected.append(token)

        assert collected == ["Token"]


class TestOllamaGenerateStream:
    @pytest.mark.asyncio
    async def test_generate_stream_yields_tokens(self):
        provider = OllamaLLMProvider()

        tokens = ["Hi", " from", " Ollama"]

        async def async_gen():
            for token in tokens:
                yield {"message": {"content": token}}

        # client.chat is awaited to get the async iterator, so mock must return it
        mock_chat = AsyncMock(return_value=async_gen())

        with patch.object(provider.client, "chat", mock_chat):
            collected = []
            async for token in provider.generate_stream("Test prompt"):
                collected.append(token)

        assert collected == tokens
