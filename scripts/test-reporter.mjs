export default async function* report(source) {
  for await (const event of source) {
    if (event.type === 'test:fail') {
      const e = event.data.details.error;
      yield `FAIL ${event.data.name}\n${event.data.file}:${event.data.line}\n${String(e?.cause?.message || e?.message).slice(0,450)}\n`;
    }
    if (event.type === 'test:summary') yield JSON.stringify(event.data) + '\n';
  }
}
