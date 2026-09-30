const fs = require('fs');

let routes = fs.readFileSync('shared/routes.ts', 'utf8');
routes = routes.replace(/\{ author: string \}/g, '{ author: string; authorBranch: string | null; authorYear: number | null }');
fs.writeFileSync('shared/routes.ts', routes);

let storage = fs.readFileSync('server/storage.ts', 'utf8');
storage = storage.replace(/\{ author: string \}/g, '{ author: string; authorBranch: string | null; authorYear: number | null }');
storage = storage.replace(/author: users\.username,/g, 'author: users.username,\n        authorBranch: users.department,\n        authorYear: users.year,');

const oldMemoryAuth = 'author: this.users.find((u) => u.id === note.userId)?.username || "Unknown",';
const newMemoryAuth = `${oldMemoryAuth}\n        authorBranch: this.users.find((u) => u.id === note.userId)?.department || null,\n        authorYear: this.users.find((u) => u.id === note.userId)?.year || null,`;

storage = storage.split(oldMemoryAuth).join(newMemoryAuth);

const oldUpload = 'const author = this.users.find((u) => u.id === userId)?.username || "Unknown";';
const newUpload = `const authorUser = this.users.find((u) => u.id === userId);
    const author = authorUser?.username || "Unknown";
    const authorBranch = authorUser?.department || null;
    const authorYear = authorUser?.year || null;`;
storage = storage.replace(oldUpload, newUpload);

storage = storage.replace(/\.map\(\(note\) => \(\{ \.\.\.note, author \}\)\);/g, '.map((note) => ({ ...note, author, authorBranch, authorYear }));');

fs.writeFileSync('server/storage.ts', storage);
console.log('Done mapping author fields');
