/**
 * Development Server
 * Serves the DORA Metrics Dashboard
 */

const server = Bun.serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Serve static files
    if (path === '/' || path === '/index.html') {
      return new Response(Bun.file('public/index.html'));
    }

    // Serve source files for development
    if (path.startsWith('/src/')) {
      const filePath = path.slice(1); // Remove leading /
      const file = Bun.file(filePath);

      if (await file.exists()) {
        const ext = path.split('.').pop();
        const contentType = ext === 'tsx' || ext === 'ts'
          ? 'application/typescript'
          : ext === 'css'
            ? 'text/css'
            : 'application/javascript';

        return new Response(file, {
          headers: { 'Content-Type': contentType },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`DORA Metrics Dashboard running at http://localhost:${server.port}`);
console.log('Press Ctrl+C to stop');
