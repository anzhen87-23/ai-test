function parseMultipart(ctx) {
  return new Promise((resolve, reject) => {
    const contentType = ctx.headers['content-type'];
    if (!contentType || !contentType.startsWith('multipart/form-data')) {
      reject(new Error('Expected multipart/form-data'));
      return;
    }

    const boundaryRaw = contentType.split('boundary=')[1];
    if (!boundaryRaw) {
      reject(new Error('Missing boundary'));
      return;
    }
    const boundaryStr = boundaryRaw.replace(/^["']|["']$/g, '').split(';')[0].trim();

    const buffers = [];
    ctx.req.on('data', (chunk) => buffers.push(chunk));
    ctx.req.on('end', () => {
      try {
        const raw = Buffer.concat(buffers);
        const delim = Buffer.from(`--${boundaryStr}\r\n`);
        const closeDelim = Buffer.from(`--${boundaryStr}--`);
        const crlfCrlf = Buffer.from('\r\n\r\n');

        const parts = [];
        let offset = 0;
        while (offset < raw.length) {
          const idx = raw.indexOf(delim, offset);
          if (idx === -1) {
            const closeIdx = raw.indexOf(closeDelim, offset);
            if (closeIdx > offset) {
              const part = raw.slice(offset, closeIdx);
              if (part.length > 0) parts.push(part);
            }
            break;
          }
          if (idx > offset) parts.push(raw.slice(offset, idx));
          offset = idx + delim.length;
        }

        const files = [];
        for (const part of parts) {
          const sepIdx = part.indexOf(crlfCrlf);
          if (sepIdx === -1) continue;

          const headerBuf = part.slice(0, sepIdx);
          let body = part.slice(sepIdx + 4);
          if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
            body = body.slice(0, -2);
          }

          const headerText = headerBuf.toString('utf8');
          const contentDisposition = headerText.split('\r\n').find((h) => h.startsWith('Content-Disposition'));
          const contentTypeHeader = headerText.split('\r\n').find((h) => h.toLowerCase().startsWith('content-type'));

          if (!contentDisposition) continue;

          const nameMatch = contentDisposition.match(/name="([^"]+)"/);
          const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''([^']+)|"([^"]+)")/);

          if (filenameMatch && nameMatch) {
            files.push({
              fieldName: nameMatch[1],
              originalName: filenameMatch[1] || filenameMatch[2] || '',
              mimeType: contentTypeHeader ? contentTypeHeader.split(':')[1].trim() : 'application/octet-stream',
              buffer: body,
            });
          }
        }

        resolve(files);
      } catch (err) {
        reject(err);
      }
    });

    ctx.req.on('error', reject);
  });
}

module.exports = { parseMultipart };
