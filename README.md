# ZKP Server

Standalone TypeScript server for Zero-Knowledge Proof generation using the full circuit (6 inputs).

## Setup

```bash
# Install dependencies
npm install

# Copy circuit files
mkdir circuits
cp ../app/public/zk/circuit.wasm circuits/
cp ../app/public/zk/circuit_final.zkey circuits/
```

## Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Generate Poseidon Hash
```bash
POST /api/hash
Content-Type: application/json

{
  "inputs": ["123456", "789012"]
}
```

### String to Field Element
```bash
POST /api/string-to-field
Content-Type: application/json

{
  "value": "testuser"
}
```

### Generate ZK Proof
```bash
POST /api/generate-proof
Content-Type: application/json

{
  "username": "8243121641273648500",
  "password": "241393873200",
  "username_hash": "13847586590743013803154134081679249182785050701626568920381050338933177863536",
  "credential_hash": "16683581446009469686908106818727560612782469820634727882505649290762305376220",
  "nonce": "12345",
  "result_hash": "15909918595703654360672999778350773892305031709122799013243453348302220720359"
}
```

### Full Authentication Flow
```bash
POST /api/auth/generate-proof
Content-Type: application/json

{
  "username": "testuser",
  "pattern": [0, 1, 2, 4, 8],
  "nonce": 12345  // Optional, will be generated if not provided
}
```

## Usage from Next.js App

```typescript
// In your Next.js app
const response = await fetch('http://localhost:4000/api/auth/generate-proof', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser',
    pattern: [0, 1, 2, 4, 8],
    nonce: 12345
  })
});

const { success, data } = await response.json();
console.log('Proof:', data.proof);
console.log('Result Hash:', data.resultHash);
```

## Cloudflare Deployment

**⚠️ Important: Cloudflare Workers CANNOT run this ZKP server.**

### Why Cloudflare Workers Won't Work:
1. **CPU Time Limit**: Workers have a 50ms-10s CPU time limit. ZK proof generation takes 30-60+ seconds
2. **Memory Limit**: Workers have 128MB memory limit. snarkjs needs much more
3. **No Native Modules**: Workers don't support Node.js native modules required by snarkjs
4. **File System**: Workers don't have file system access for WASM/ZKEY files

### Recommended Hosting Options:

#### 1. **Railway.app** (Easiest)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway init
railway up
```

#### 2. **Render.com** (Free tier available)
- Create `render.yaml`:
```yaml
services:
  - type: web
    name: zkp-server
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
```

#### 3. **DigitalOcean App Platform**
- Push to GitHub
- Connect repository
- Auto-deploys on push

#### 4. **VPS (Recommended for production)**
- AWS EC2, DigitalOcean Droplet, or Linode
- Full control, no time limits
- Can optimize for ZK proof generation

### Alternative: Use Cloudflare for Frontend Only
Host your Next.js app on Cloudflare Pages and point ZKP requests to a separate VPS/Railway backend.
