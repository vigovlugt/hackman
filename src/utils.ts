export function json(body: any, init?: ResponseInit | undefined) {
	return new Response(JSON.stringify(body), {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
}
