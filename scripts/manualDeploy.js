import pkg from "@ton/core";
import tonpkg from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";
import fs from "fs";

const { Address, Cell, toNano, beginCell, contractAddress, fromNano } = pkg;
const { TonClient4, WalletContractV5R1, internal } = tonpkg;

// === Настройки ===
const MNEMONIC = "word1 word2 word3 ... word24"; // Замените на свою фразу
const CONTRACT_FILE = "/workspace/build/BdbSale.compiled.json"; // путь к скомпилированному контракту

// Инициализационные параметры
const OWNER = "UQC7SWSjzNB91HA3ku2v7eMoYuemM__puqmXUi1e4hmORkTP"; // ваш кошелек-владелец
const BDB_MASTER = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c"; // ЗАМЕНИТЕ на мастер BDB
const USDT_MASTER = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9u"; // ЗАМЕНИТЕ на мастер USDT (опционально)

// Цены и лимиты
const PRICE_TON_PER_BDB = 5000n;      // нанотонов за 1 BDB (base unit)
const PRICE_USDT_PER_BDB = 0n;        // единиц USDT за 1 BDB (пока 0 если не продаете за USDT)
const REMAINING_SUPPLY = 200000000n;  // сколько BDB продаем (в base units)

// Изначально кошельки пустые (addr_none). После деплоя установим через SetWallets
const BDB_WALLET_ADDR = "";  // можно сразу указать, если уже известен
const USDT_WALLET_ADDR = ""; // можно сразу указать, если уже известен

// Сообщения админа
function buildSetWalletsMessage(bdbWallet, usdtWallet) {
	return beginCell()
		.storeUint(0xbdb50001, 32) // произвольный op для SetWallets (Tact сам мапит, но для простоты используем уникальный)
		.storeRef(
			beginCell()
				.storeAddress(bdbWallet)
				.storeAddress(usdtWallet)
				.endCell()
		)
		.endCell();
}

function buildUpdateTonPriceMessage(newPrice) {
	return beginCell()
		.storeUint(0xbdb50002, 32)
		.storeRef(
			beginCell().storeUint(newPrice, 64).endCell()
		)
		.endCell();
}

function buildUpdateUsdtPriceMessage(newPrice) {
	return beginCell()
		.storeUint(0xbdb50003, 32)
		.storeRef(
			beginCell().storeUint(newPrice, 64).endCell()
		)
		.endCell();
}

async function main() {
	const client = new TonClient4({ endpoint: "https://mainnet-v4.tonhubapi.com" });

	// Код контракта
	const compiled = JSON.parse(fs.readFileSync(CONTRACT_FILE, "utf-8"));
	if (!compiled?.hex) throw new Error("compiled.json без поля hex");
	const codeCell = Cell.fromBoc(Buffer.from(compiled.hex, "hex"))[0];

	// Data — порядок как в init BdbSale(init: owner, bdbMaster, usdtMaster, priceTonPerBdb, priceUsdtPerBdb, remainingSupply, bdbWallet, usdtWallet)
	const dataCell = beginCell()
		.storeAddress(Address.parse(OWNER))
		.storeAddress(Address.parse(BDB_MASTER))
		.storeAddress(Address.parse(USDT_MASTER))
		.storeUint(PRICE_TON_PER_BDB, 64)
		.storeUint(PRICE_USDT_PER_BDB, 64)
		.storeUint(REMAINING_SUPPLY, 64)
		.storeAddress(BDB_WALLET_ADDR ? Address.parse(BDB_WALLET_ADDR) : null)
		.storeAddress(USDT_WALLET_ADDR ? Address.parse(USDT_WALLET_ADDR) : null)
		.endCell();

	const saleAddress = contractAddress(0, { code: codeCell, data: dataCell });
	console.log("✅ Sale address:", saleAddress.toString());
	console.log(`🔎 Tonviewer: https://tonviewer.com/${saleAddress.toString()}`);

	// Открываем кошелек
	const key = await mnemonicToWalletKey(MNEMONIC.trim().split(/\s+/g));
	const wallet = client.open(WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey }));
	console.log("🔑 Wallet:", wallet.address.toString());
	const balance = await wallet.getBalance();
	console.log("💰 Balance:", fromNano(balance), "TON");
	if (balance < toNano("0.2")) throw new Error("Недостаточно TON для деплоя и админ-коллов (~0.2 TON)");

	// Deploy с StateInit
	console.log("🚀 Deploy...");
	let seqno = await wallet.getSeqno();
	await wallet.sendTransfer({
		secretKey: key.secretKey,
		seqno,
		messages: [
			internal({
				to: saleAddress,
				value: toNano("0.12"),
				bounce: false,
				init: { code: codeCell, data: dataCell },
			}),
		],
	});
	console.log("✅ Deploy sent. Wait 30-60s...");

	// Ждём инкремента seqno
	while (true) {
		const next = await wallet.getSeqno();
		if (next !== seqno) break;
		await new Promise((r) => setTimeout(r, 3000));
	}

	// Если нужны SetWallets/UpdatePrice — пошлём после деплоя (опционально)
	// Пример: установить кошельки и обновить цены
	const needSetWallets = false; // переключите в true и заполните адреса выше
	if (needSetWallets) {
		seqno = await wallet.getSeqno();
		await wallet.sendTransfer({
			secretKey: key.secretKey,
			seqno,
			messages: [
				internal({
					to: saleAddress,
					value: toNano("0.05"),
					bounce: true,
					body: buildSetWalletsMessage(
						Address.parse(BDB_WALLET_ADDR),
						Address.parse(USDT_WALLET_ADDR)
					),
				}),
			],
		});
		console.log("✅ SetWallets sent");
	}

	// Пример: обновить цены (опционально)
	const needUpdatePrices = false;
	if (needUpdatePrices) {
		seqno = await wallet.getSeqno();
		await wallet.sendTransfer({
			secretKey: key.secretKey,
			seqno,
			messages: [
				internal({
					to: saleAddress,
					value: toNano("0.03"),
					bounce: true,
					body: buildUpdateTonPriceMessage(PRICE_TON_PER_BDB),
				}),
				internal({
					to: saleAddress,
					value: toNano("0.03"),
					bounce: true,
					body: buildUpdateUsdtPriceMessage(PRICE_USDT_PER_BDB),
				}),
			],
		});
		console.log("✅ Update prices sent");
	}

	console.log("🎉 Done. Check:", `https://tonviewer.com/${saleAddress.toString()}`);
}

main().catch((e) => {
	console.error("❌ Error:", e);
	process.exit(1);
});