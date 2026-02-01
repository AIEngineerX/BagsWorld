import bs58 from "bs58";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

const txStr =
  "TQ5P7gNcZjisEAYaHNWUhWsCZyDbCEvp1ecQvbEaxFxfArTcmxPbytZ8HSh31VtXZ7JoSRET2DWVrZt9Pm3Kmgxsb7CJR6y5czagUZTgQbnWEe4w1Zi3X9w6h9fKbXX6v9bmNJfpSrfc8kdvwLMTuMUwrQGB5Wr2YNx2Cnd1Ayn5xvQkVo6hPNkr3CKGdCdoRid8hB9g2jfh5pXvSsYGHiechzN7mbN6hHYbRsfWRns1rp5BX7RG1V4JjaM3Mc2x7BEacFJZNengA29ePayfw9pyw4SCEE8Ye4jCcomGQSKscF7gGQpGw4TGRQgP3dpuRncBhm4pjqVQobQrcvYCBdxQgoBMQrRyj9wptHAZxbAKRhcWCPdJn8ksa76oNnfAnj3VjgRU5kEE28m7U6GrmyqCHjwjWg3p2dePLVQpkGmNgUq5WcaXdaoA9Wy3piNqnoKEE2M2dXrzb5WV7PJK1TyVWoEhJYfZc1UhhYTx4ibTbBSJcWF1mJJRnWxb2eAZTbRCAiAbhbTDzkQZswAYKv3eSEnm4MaXLEGfiGRnfw6PgszaG1gzB89o1VgD7iTbwg5o8hprnAMeNuFsvu7jkuCmCsx8psggrpMhuBaKLChtwrjQS5c5LsyX3pTr6BfpdReoXc8Y7AUvrn8DQw1UJRqZH7HPHzde4yDHVZteHCKznXARfsLBi9LbgWWzqYQzPyXoJGepJFWeHEsxDX8AsEskpDzgXUUJWLhC3ENnL1TsDkEmmQWdwUhyywGfbajSxTgQ";
const buf = bs58.decode(txStr);

console.log("Buffer length:", buf.length);
console.log("First bytes:", Array.from(buf.slice(0, 5)));

try {
  const legacy = Transaction.from(buf);
  console.log("Legacy parsed! Instructions:", legacy.instructions.length);
} catch (e: any) {
  console.log("Legacy failed:", e.message);
}

try {
  const versioned = VersionedTransaction.deserialize(buf);
  console.log("Versioned parsed! Version:", versioned.version);
} catch (e: any) {
  console.log("Versioned failed:", e.message);
}
