// Welk taalmodel de app gebruikt: Claude via de Anthropic-API (ANTHROPIC_API_KEY). Zonder sleutel draaien alle AI-functies op
// lokale regels. Europese verwerking is bij de Anthropic-API niet vanzelf gegarandeerd; zet AI_VERWERKING_REGIO=eu pas als
// dat contractueel is vastgelegd, dan toont de privacypagina het als aangetoond.

export function aiAan(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export function aiVerwerking(env: Record<string, string | undefined> = process.env) {
  const aan = aiAan(env);
  return { aan, europees: aan && (env.AI_VERWERKING_REGIO ?? "").toLowerCase() === "eu", label: aan ? "Claude via de Anthropic-API" : "geen extern taalmodel" };
}
