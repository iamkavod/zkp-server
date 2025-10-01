import express, { Request, Response } from 'express';
import cors from 'cors';
import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Types
interface ZKProofData {
  a: string[];
  b: string[][];
  c: string[];
}

interface CircuitInputs {
  username: string;
  password: string;
  username_hash: string;
  credential_hash: string;
  nonce: string;
  result_hash: string;
}

interface ProofResult {
  proof: ZKProofData;
  publicSignals: string[];
}

// ZKP Helper Class
class ZKProofGenerator {
  private static wasmPath = join(__dirname, '..', 'circuits', 'circuit.wasm');
  private static zkeyPath = join(__dirname, '..', 'circuits', 'circuit_final.zkey');

  static async hashWithPoseidon(inputs: bigint[]): Promise<string> {
    const poseidon: any = await buildPoseidon();
    const hashResult: any = poseidon(inputs);
    
    let result: string;
    if (typeof hashResult === 'bigint') {
      result = hashResult.toString();
    } else if (hashResult && typeof hashResult === 'object') {
      result = poseidon.F.toString(hashResult);
    } else {
      result = String(hashResult);
    }
    
    return result;
  }

  static stringToFieldElement(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let result = BigInt(0);

    for (let i = 0; i < Math.min(bytes.length, 31); i++) {
      result += BigInt(bytes[i]) * (BigInt(256) ** BigInt(i));
    }

    return result.toString();
  }

  static async generateProof(inputs: CircuitInputs): Promise<ProofResult> {
    try {
      console.log('🔧 Loading ZK circuit files...');
      console.log('📁 WASM:', this.wasmPath);
      console.log('🔑 ZKEY:', this.zkeyPath);
      
      const startTime = Date.now();
      
      const { proof, publicSignals } = await groth16.fullProve(
        inputs as any,
        this.wasmPath,
        this.zkeyPath
      );
      
      const endTime = Date.now();
      console.log(`✅ Proof generated in ${(endTime - startTime) / 1000} seconds`);

      return {
        proof: {
          a: [proof.pi_a[0], proof.pi_a[1]],
          b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
          c: [proof.pi_c[0], proof.pi_c[1]]
        },
        publicSignals
      };
    } catch (error: any) {
      console.error('❌ ZK proof generation failed:', error);
      throw new Error(`Failed to generate ZK proof: ${error.message}`);
    }
  }
}

// Routes

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'ZKP Server is running' });
});

// Generate Poseidon hash
app.post('/api/hash', async (req: Request, res: Response) => {
  try {
    const { inputs } = req.body;
    
    if (!inputs || !Array.isArray(inputs)) {
      return res.status(400).json({ error: 'Invalid inputs. Expected array of values.' });
    }

    const bigIntInputs = inputs.map((i: string | number) => BigInt(i));
    const hash = await ZKProofGenerator.hashWithPoseidon(bigIntInputs);

    res.json({ hash });
  } catch (error: any) {
    console.error('Hash generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert string to field element
app.post('/api/string-to-field', (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    
    if (!value) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const fieldElement = ZKProofGenerator.stringToFieldElement(value);
    res.json({ fieldElement });
  } catch (error: any) {
    console.error('String to field conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate ZK proof
app.post('/api/generate-proof', async (req: Request, res: Response) => {
  try {
    const { username, password, username_hash, credential_hash, nonce, result_hash } = req.body;

    if (!username || !password || !username_hash || !credential_hash || !nonce || !result_hash) {
      return res.status(400).json({ 
        error: 'Missing required fields: username, password, username_hash, credential_hash, nonce, result_hash' 
      });
    }

    console.log('📝 Generating proof with inputs:', {
      username,
      password,
      username_hash,
      credential_hash,
      nonce,
      result_hash
    });

    const proofData = await ZKProofGenerator.generateProof({
      username,
      password,
      username_hash,
      credential_hash,
      nonce,
      result_hash
    });

    res.json({
      success: true,
      proof: proofData.proof,
      publicSignals: proofData.publicSignals
    });
  } catch (error: any) {
    console.error('Proof generation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Full authentication flow
app.post('/api/auth/generate-proof', async (req: Request, res: Response) => {
  try {
    const { username, pattern, nonce } = req.body;

    if (!username || !pattern || !Array.isArray(pattern)) {
      return res.status(400).json({ 
        error: 'Missing required fields: username (string), pattern (array)' 
      });
    }

    console.log('🔐 Full auth flow for:', username);

    // Convert to field elements
    const usernameField = ZKProofGenerator.stringToFieldElement(username);
    const passwordField = ZKProofGenerator.stringToFieldElement(pattern.join(''));

    // Generate hashes
    const usernameHash = await ZKProofGenerator.hashWithPoseidon([BigInt(usernameField)]);
    const credentialHash = await ZKProofGenerator.hashWithPoseidon([
      BigInt(usernameField),
      BigInt(passwordField)
    ]);

    // Use provided nonce or generate one
    const nonceValue = nonce || Math.floor(Math.random() * 1000000);
    const resultHash = await ZKProofGenerator.hashWithPoseidon([
      BigInt(credentialHash),
      BigInt(nonceValue)
    ]);

    // Generate proof
    const proofData = await ZKProofGenerator.generateProof({
      username: usernameField,
      password: passwordField,
      username_hash: usernameHash,
      credential_hash: credentialHash,
      nonce: nonceValue.toString(),
      result_hash: resultHash
    });

    res.json({
      success: true,
      data: {
        usernameHash,
        credentialHash,
        resultHash,
        nonce: nonceValue,
        proof: proofData.proof,
        publicSignals: proofData.publicSignals
      }
    });
  } catch (error: any) {
    console.error('Auth proof generation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ZKP Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
