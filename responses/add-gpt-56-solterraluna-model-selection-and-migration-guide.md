# Add GPT-5.6 Sol/Terra/Luna model-selection and migration guide

## CONTEXT
OpenAI announced general availability of the GPT-5.6 family across ChatGPT, Codex, and API, with Sol as the flagship model, Terra as the balanced lower-cost option, and Luna as the fastest/cost-efficient option. Primary OpenAI launch and preview posts emphasize “more intelligence from every token,” performance per dollar, Terra matching GPT-5.5-class performance at lower cost, and Sol on Cerebras at up to 750 tokens/sec. Sources: [GA post](https://openai.com/index/gpt-5-6/), [preview post](https://openai.com/index/previewing-gpt-5-6-sol/), [third-party summary](https://coursiv.io/blog/chatgpt-5-6).

## WHY IT MATTERS
The tiering changes how developers and enterprises choose models by latency, price, and capability. Without a clear canonical migration path and model-selection guide, customers may overpay, underuse Luna/Terra, or rely on inconsistent third-party explanations.

## RECOMMENDED ACTION
Create a docs PR that adds a GPT-5.6 model-selection and migration guide covering Sol/Terra/Luna, recommended workloads, latency/cost tradeoffs, deprecation guidance for older GPT-5.x models, API examples, eval guidance, and links to pricing/rate-limit details.
