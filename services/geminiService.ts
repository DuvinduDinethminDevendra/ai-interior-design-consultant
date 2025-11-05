
// Client-side proxy functions that call the local server endpoints.
// The server (server/server.js) holds the real @google/genai usage and your API key.

export async function generateRedesignedImage(
    imageBase64: string,
    prompt: string,
    isRefinement: boolean = false
): Promise<string> {
    const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, prompt, isRefinement }),
    });

    if (!res.ok) {
        // Read the body as text once, then attempt to parse JSON from it.
        const bodyText = await res.text();
        let errMsg = bodyText;
        let retryAfterSeconds: number | null = null;
        try {
            const parsed = JSON.parse(bodyText);
            errMsg = parsed?.error || JSON.stringify(parsed);
            if (parsed?.retryAfterSeconds != null) retryAfterSeconds = Number(parsed.retryAfterSeconds);
        } catch (_e) {
            // bodyText stays as-is when not valid JSON
            const m = String(bodyText).match(/retry in\s*([0-9]+(?:\.[0-9]+)?)s/i);
            if (m) retryAfterSeconds = Math.ceil(Number(m[1]));
        }

        const e: any = new Error(`${res.status} ${res.statusText} - ${errMsg}`);
        e.status = res.status;
        if (retryAfterSeconds != null) e.retryAfter = retryAfterSeconds;
        throw e;
    }

    const data = await res.json();
    return data.image;
}

type ChatResponse = { text: string };

export function initializeChat(style: string) {
    // Return a minimal object with sendMessage to mimic the Chat used in the client.
    return {
        async sendMessage(message: string): Promise<ChatResponse> {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ style, message }),
            });


            if (!res.ok) {
                // Read the body as text once, then attempt to parse JSON from it.
                const bodyText = await res.text();
                let errMsg = bodyText;
                let retryAfterSeconds: number | null = null;
                try {
                    const parsed = JSON.parse(bodyText);
                    errMsg = parsed?.error || JSON.stringify(parsed);
                    if (parsed?.retryAfterSeconds != null) retryAfterSeconds = Number(parsed.retryAfterSeconds);
                } catch (_e) {
                    const m = String(bodyText).match(/retry in\s*([0-9]+(?:\.[0-9]+)?)s/i);
                    if (m) retryAfterSeconds = Math.ceil(Number(m[1]));
                }
                const e: any = new Error(`${res.status} ${res.statusText} - ${errMsg}`);
                e.status = res.status;
                if (retryAfterSeconds != null) e.retryAfter = retryAfterSeconds;
                throw e;
            }

            const data = await res.json();
            return { text: data.text };
        },
    };
}
