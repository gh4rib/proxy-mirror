// api/proxy.js - Handles all HTTP methods and strips mirror redirects

const MIRROR_BASE_URL = 'http://pkg0.nyi.freebsd.org:80'; // CHANGE IT

export default async function handler(req, res) {
    // Build the target URL from the request path + query
    const path = req.url || '/';
    const targetUrl = new URL(path, MIRROR_BASE_URL);

    // Copy relevant request headers (skip Host, connection, etc.)
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        const lowerKey = key.toLowerCase();
        if (!['host', 'connection', 'keep-alive', 'transfer-encoding'].includes(lowerKey)) {
            headers.set(key, value);
        }
    }
    // Set the correct Host header for the mirror
    const mirrorHost = new URL(MIRROR_BASE_URL).host;
    headers.set('Host', mirrorHost);

    // Prepare fetch options
    const fetchOptions = {
        method: req.method,
        headers: headers,
        // Body forwarding for POST/PUT etc.
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = req; // req is a readable stream
    }

    try {
        const response = await fetch(targetUrl.toString(), fetchOptions);

        // Set response status
        res.status(response.status);

        // Forward all headers EXCEPT Location (to prevent redirect to mirror)
        for (const [key, value] of response.headers.entries()) {
            if (key.toLowerCase() !== 'location') {
                res.setHeader(key, value);
            }
        }

        // Stream the response body back to the client
        const body = response.body;
        if (body) {
            // For Node.js < 18, you may need to use a buffer, but Vercel supports web streams
            const reader = body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
        }
        res.end();
    } catch (error) {
        console.error(error);
        res.status(502).send('Proxy error: ' + error.message);
    }
}

// Optional: configure body parsing limit (Vercel defaults are fine)
export const config = {
    api: {
        bodyParser: false, // allow raw stream for request body
    },
};
