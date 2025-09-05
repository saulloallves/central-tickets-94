/**
 * OpenAI client with retry logic
 */

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

export async function openAI(path: string, payload: any, tries = 3) {
  let wait = 300;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) return r;
    if (r.status === 429 || r.status === 503) { 
      await new Promise(res => setTimeout(res, wait)); 
      wait *= 2; 
      continue; 
    }
    throw new Error(`${path} error: ${await r.text()}`);
  }
  throw new Error(`${path} error: too many retries`);
}

export { openaiApiKey };