import { initializeKeypair } from "./initializeKeypair"
import * as web3 from "@solana/web3.js"
import * as token from '@solana/spl-token'
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
  findMetadataPda
} from '@metaplex-foundation/js'
import {
  DataV2,
  createCreateMetadataAccountV2Instruction,
  createUpdateMetadataAccountV2Instruction
} from '@metaplex-foundation/mpl-token-metadata'
import * as fs from 'fs'
import { mintTo, mintToCheckedInstructionData, mintToInstructionData } from "@solana/spl-token"

async function createNewMint(
  connection: web3.Connection,
  payer: web3.Keypair,
  mintAuthority: web3.PublicKey,
  freezeAuthority: web3.PublicKey,
  decimals: number
) {
  const tokenMint = await token.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  )

  console.log(`Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`)

  return tokenMint
}

async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey
) {
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  )

  console.log(`Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`)

  return tokenAccount
}

async function mintToken(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number
) {
  const mintInfo = await token.getMint(connection, mint)

  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount * 10 ** mintInfo.decimals
  )

  console.log(`Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`)
}

async function transferTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number,
  mint: web3.PublicKey
) {
  const mintInfo = await token.getMint(connection, mint)
  const transactionSignature = await token.transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount * 10 ** mintInfo.decimals
  )

  console.log(`Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`)
}

async function createMetadata(
  connection: web3.Connection,
  metaplex: Metaplex,
  mint: web3.PublicKey,
  user: web3.Keypair,
  name: string,
  symbol: string,
  description: string,
  filePath: string,
  fileName: string
) {
  // read our image from file
  const buffer = fs.readFileSync(filePath)

  const file = toMetaplexFile(buffer, fileName)

  const imageUri = await metaplex.storage().upload(file)
  console.log(imageUri)

  const { uri } = await metaplex.nfts().uploadMetadata({
    name: name,
    description,
    image: imageUri,
  })
  .run()

  // Create onchain portion of metadata
  console.log('metadata uri:', uri)

  const metadataPDA = await findMetadataPda(mint)

  const tokenMetadata = {
    name: name,
    symbol: symbol,
    uri: uri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null
  } as DataV2

  const instruction = createCreateMetadataAccountV2Instruction(
    {
      metadata: metadataPDA,
      mint: mint,
      mintAuthority: user.publicKey,
      payer: user.publicKey,
      updateAuthority: user.publicKey,
    },
    {
      createMetadataAccountArgsV2: {
        data: tokenMetadata,
        isMutable: true
      }
    }
  )

  const transaction = new web3.Transaction()
  transaction.add(instruction)

  const transactionSignature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [user]
  )

  console.log(
    `Create Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}

async function updateTokenMetadata(
  connection: web3.Connection,
  metaplex: Metaplex,
  mint: web3.PublicKey,
  user: web3.Keypair,
  name: string,
  symbol: string,
  description: string,
  filePath: string,
  fileName: string
) {
  const buffer = fs.readFileSync(filePath)

  const file = toMetaplexFile(buffer, fileName)

  const imageUri = await metaplex.storage().upload(file)

  const { uri } = await metaplex
    .nfts()
    .uploadMetadata({
      name: name,
      description: description,
      image: imageUri,
    })
    .run()

  console.log("metadata uri:", uri)

  const metadataPDA = await findMetadataPda(mint)

  const tokenMetadata = {
    name: name,
    symbol: symbol,
    uri: uri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null
  } as DataV2

  const instruction = createUpdateMetadataAccountV2Instruction(
    {
      metadata: metadataPDA,
      updateAuthority: user.publicKey
    },
    {
      updateMetadataAccountArgsV2: {
        data: tokenMetadata,
        updateAuthority: user.publicKey,
        primarySaleHappened: true,
        isMutable: true
      }
    }
  )

  const transaction = new web3.Transaction()
  transaction.add(instruction)

  const transactionSignature = await web3.sendAndConfirmTransaction(
    connection, 
    transaction, 
    [user]
  )

  console.log(
    `Update Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}

async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  console.log("PublicKey:", user.publicKey.toBase58())

  // const mint = await createNewMint(
  //   connection,
  //   user,
  //   user.publicKey,
  //   user.publicKey,
  //   2
  // )

  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
      })
    )

  // await createMetadata(
  //   connection,
  //   metaplex,
  //   mint,
  //   user,
  //   "Sh*t Token",
  //   "POOP",
  //   "a really sh*t token",
  //   'assets/poop.png',
  //   'poop.png'
  // )

  // const tokenAccount = await createTokenAccount(
  //   connection,
  //   user,
  //   mint, 
  //   user.publicKey
  // )

  // await mintToken(
  //   connection,
  //   user,
  //   mint,
  //   tokenAccount.address,
  //   user,
  //   100
  // )

  // const recipientTokenAccount = await token.getOrCreateAssociatedTokenAccount(
  //   connection,
  //   user,
  //   mint,
  //   new web3.PublicKey('9LPVbvXbFJJwBB4WhfdbgqtmW3JR3pxE4R6TWJCS9Xbd')
  // )

  // await transferTokens(
  //   connection,
  //   user,
  //   tokenAccount.address,
  //   recipientTokenAccount.address,
  //   user.publicKey,
  //   50,
  //   mint
  // )
  const mint = new web3.PublicKey("28SzLfAU6UX8e7zgkAmvhB8cchfTUDipmt9XfQA6kVpH")
  await updateTokenMetadata(
    connection,
    metaplex,
    mint,
    user,
    "Build Sh*t Token",
    "POOPY",
    "Poopy token for buildoors",
    "assets/poop.png",
    "poop.png"
  )
}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
