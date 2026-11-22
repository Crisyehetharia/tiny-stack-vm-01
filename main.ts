// Tiny stack VM (make.fun tiny-stack-vm-01): answers every instance in
// MAKEFUN_INPUT_DIR, writing stdout.bin + exit.txt per instance. ISA.md, 37 opcodes, 10 traps.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

for (const id of readdirSync(I).sort()) {
  const [out, code] = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), Buffer.from(out));
  writeFileSync(join(O, id, 'exit.txt'), code + '\n');
}

function run(p, inp) {
  const st = new Int32Array(256);
  const cs = new Int32Array(64);
  const mem = new Int32Array(256);
  const out = [];
  let sp = 0, cp = 0, ip = 0, pc = 0, steps = 0, code = -1;
  const plen = p.length;
  while (code < 0) {
    if (steps >= 1000000) { code = 10; break; }
    if (pc < 0 || pc >= plen) { code = 9; break; }
    const op = p[pc];
    let npc = pc + 1, imm = 0;
    if (op === 1) {
      if (pc + 1 >= plen) { code = 9; break; }
      imm = p[pc + 1]; if (imm > 127) imm -= 256; npc = pc + 2;
    } else if (op === 2) {
      if (pc + 4 >= plen) { code = 9; break; }
      imm = p[pc + 1] | (p[pc + 2] << 8) | (p[pc + 3] << 16) | (p[pc + 4] << 24); npc = pc + 5;
    } else if (op >= 48 && op <= 51) {
      if (pc + 2 >= plen) { code = 9; break; }
      imm = p[pc + 1] | (p[pc + 2] << 8); npc = pc + 3;
    } else if (op !== 0 && !(op >= 3 && op <= 7) && !(op >= 16 && op <= 34) && op !== 52 && !(op >= 64 && op <= 65) && !(op >= 80 && op <= 83)) { code = 5; break; }
    steps++;
    let np = npc, a, b, s;
    switch (op) {
      case 0: code = 0; break;
      case 1: case 2:
        if (sp >= 256) { code = 3; break; }
        st[sp++] = imm; break;
      case 3:
        if (sp < 1) { code = 2; break; }
        sp--; break;
      case 4:
        if (sp < 1) { code = 2; break; }
        if (sp >= 256) { code = 3; break; }
        st[sp] = st[sp - 1]; sp++; break;
      case 5:
        if (sp < 2) { code = 2; break; }
        a = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = a; break;
      case 6:
        if (sp < 2) { code = 2; break; }
        if (sp >= 256) { code = 3; break; }
        st[sp] = st[sp - 2]; sp++; break;
      case 7:
        if (sp < 3) { code = 2; break; }
        a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34:
        if (sp < 2) { code = 2; break; }
        b = st[--sp]; a = st[sp - 1];
        if (op === 16) st[sp - 1] = (a + b) | 0;
        else if (op === 17) st[sp - 1] = (a - b) | 0;
        else if (op === 18) st[sp - 1] = Math.imul(a, b);
        else if (op === 19) { if (b === 0) { code = 4; break; } st[sp - 1] = Math.trunc(a / b) | 0; }
        else if (op === 20) { if (b === 0) { code = 4; break; } st[sp - 1] = a % b; }
        else if (op === 21) { if (b === 0) { code = 4; break; } st[sp - 1] = Math.trunc((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (b === 0) { code = 4; break; } st[sp - 1] = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) st[sp - 1] = a & b;
        else if (op === 25) st[sp - 1] = a | b;
        else if (op === 26) st[sp - 1] = a ^ b;
        else if (op === 28) st[sp - 1] = a << (b & 31);
        else if (op === 29) st[sp - 1] = a >> (b & 31);
        else if (op === 30) st[sp - 1] = (a >>> (b & 31)) | 0;
        else if (op === 32) st[sp - 1] = a === b ? 1 : 0;
        else if (op === 33) st[sp - 1] = a < b ? 1 : 0;
        else st[sp - 1] = (a >>> 0) < (b >>> 0) ? 1 : 0;
        break;
      case 23:
        if (sp < 1) { code = 2; break; }
        st[sp - 1] = (-st[sp - 1]) | 0; break;
      case 27:
        if (sp < 1) { code = 2; break; }
        st[sp - 1] = ~st[sp - 1]; break;
      case 48:
        np = npc + (imm >= 32768 ? imm - 65536 : imm); break;
      case 49:
        if (sp < 1) { code = 2; break; }
        if (st[--sp] === 0) np = npc + (imm >= 32768 ? imm - 65536 : imm); break;
      case 50:
        if (sp < 1) { code = 2; break; }
        if (st[--sp] !== 0) np = npc + (imm >= 32768 ? imm - 65536 : imm); break;
      case 51:
        if (cp >= 64) { code = 7; break; }
        cs[cp++] = npc; np = imm; break;
      case 52:
        if (cp === 0) { code = 8; break; }
        np = cs[--cp]; break;
      case 64:
        if (sp < 1) { code = 2; break; }
        a = st[sp - 1];
        if (a < 0 || a > 255) { code = 6; break; }
        st[sp - 1] = mem[a]; break;
      case 65:
        if (sp < 2) { code = 2; break; }
        a = st[--sp]; b = st[--sp];
        if (a < 0 || a > 255) { code = 6; break; }
        mem[a] = b; break;
      case 80:
        if (sp < 1) { code = 2; break; }
        a = st[--sp]; s = String(a);
        if (out.length + s.length > 65536) { code = 11; break; }
        for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
        break;
      case 81:
        if (sp < 1) { code = 2; break; }
        a = st[--sp];
        if (out.length + 1 > 65536) { code = 11; break; }
        out.push(a & 255); break;
      case 82:
        if (sp >= 256) { code = 3; break; }
        st[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83:
        if (sp < 1) { code = 2; break; }
        code = st[--sp] & 255; break;
    }
    pc = np;
  }
  return [out, code];
}
