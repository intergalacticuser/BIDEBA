// BdbSale.tact
// Tact >= 1.6

contract BdbSale {
	owner: Address;
	bdbMaster: Address;      // BDB jetton master
	usdtMaster: Address;     // USDT jetton master (optional for now)
	priceTonPerBdb: Int as uint64;   // nanotons per 1 BDB token unit
	priceUsdtPerBdb: Int as uint64;  // USDT base units per 1 BDB token unit
	remainingSupply: Int as uint64;  // remaining BDB tokens for sale (in token base units)

	// Jetton wallets owned by this sale contract; set after deploy via admin op
	bdbWallet: Address?;  // addr_none until set
	usdtWallet: Address?; // addr_none until set

	// Gas constants
	const FORWARD_TON: Int = 50000000;    // 0.05 TON in nanotons
	const WALLET_CALL_TON: Int = 70000000; // 0.07 TON in nanotons (>= FORWARD_TON)

	// Admin opcodes
	const OP_SET_WALLETS: Int = 0xbdb50001;
	const OP_UPDATE_TON_PRICE: Int = 0xbdb50002;
	const OP_UPDATE_USDT_PRICE: Int = 0xbdb50003;
	const OP_JETTON_NOTIFICATION: Int = 0x7362d09c; // transfer_notification

	init(owner: Address,
		 bdbMaster: Address,
		 usdtMaster: Address,
		 priceTonPerBdb: Int as uint64,
		 priceUsdtPerBdb: Int as uint64,
		 remainingSupply: Int as uint64,
		 bdbWallet: Address?,
		 usdtWallet: Address?) {
		self.owner = owner;
		self.bdbMaster = bdbMaster;
		self.usdtMaster = usdtMaster;
		self.priceTonPerBdb = priceTonPerBdb;
		self.priceUsdtPerBdb = priceUsdtPerBdb;
		self.remainingSupply = remainingSupply;
		self.bdbWallet = bdbWallet;   // addr_none initially
		self.usdtWallet = usdtWallet; // addr_none initially
	}

	// Unified receiver: admin ops, USDT notifications, and TON purchases
	receive(in_msg: slice) {
		let ctx = context();

		if (in_msg.bits() >= 32) {
			let op = in_msg.loadUint(32);

			// Admin: set wallets
			if (op == self.OP_SET_WALLETS) {
				if (ctx.sender != self.owner) { throw(403); }
				let newBdb = in_msg.loadAddress();
				let newUsdt = in_msg.loadAddress();
				self.bdbWallet = newBdb;
				self.usdtWallet = newUsdt;
				return;
			}

			// Admin: update TON price
			if (op == self.OP_UPDATE_TON_PRICE) {
				if (ctx.sender != self.owner) { throw(403); }
				let p = in_msg.loadUint(64);
				self.priceTonPerBdb = p;
				return;
			}

			// Admin: update USDT price
			if (op == self.OP_UPDATE_USDT_PRICE) {
				if (ctx.sender != self.owner) { throw(403); }
				let p = in_msg.loadUint(64);
				self.priceUsdtPerBdb = p;
				return;
			}

			// USDT transfer notification from our USDT wallet
			if (op == self.OP_JETTON_NOTIFICATION) {
				self.handleUsdtNotification(in_msg);
				return;
			}
		}

		// TON purchase path (plain TON transfer)
		if (ctx.value <= 0) {
			return;
		}
		if (self.priceTonPerBdb <= 0) { throw(400); } // price not set
		if (self.bdbWallet == null) { throw(405); }   // BDB wallet not set

		// Reserve gas to call BDB wallet (wallet call + forward)
		let usableValue: Int = ctx.value - self.WALLET_CALL_TON;
		if (usableValue <= 0) { throw(101); } // too low value

		let amount: Int = usableValue / self.priceTonPerBdb;
		if (amount <= 0) { throw(101); }
		if (amount > self.remainingSupply) { throw(102); }

		let bdbWalletAddr = (self.bdbWallet!!);

		// Build jetton transfer from our BDB wallet to buyer
		let transferMsg = beginCell()
			.storeUint(0x0f8a7ea5, 32) // op::transfer
			.storeUint(0, 64)          // query_id
			.storeCoins(amount)        // amount of BDB (base units)
			.storeAddress(ctx.sender)  // destination: buyer
			.storeAddress(self.owner)  // response_destination
			.storeMaybeRef(null)       // custom_payload
			.storeCoins(self.FORWARD_TON) // forward_ton_amount to buyer's wallet
			.storeBit(1)               // forward_payload: 1 => by reference
			.storeRef(beginCell().endCell())
			.endCell();

		send(SendParameters {
			to: bdbWalletAddr,
			value: self.WALLET_CALL_TON,
			bounce: true,
			body: transferMsg
		});

		// Forward remaining TON to owner
		send(SendParameters {
			to: self.owner,
			value: ctx.value - self.WALLET_CALL_TON,
			bounce: false
		});

		self.remainingSupply = self.remainingSupply - amount;
	}

	fn handleUsdtNotification(in_msg: slice) {
		let ctx = context();

		if (self.usdtWallet == null) { throw(406); }
		let usdtWalletAddr = (self.usdtWallet!!);
		if (ctx.sender != usdtWalletAddr) { throw(407); }

		// Parse TIP-3 transfer_notification payload
		let _query = in_msg.loadUint(64);
		let paidUsdt = in_msg.loadCoins();
		let buyer = in_msg.loadAddress();
		// forward_payload (Either Cell ^Cell) — ignored
		// no need to parse further for our purposes

		if (self.priceUsdtPerBdb <= 0) { throw(400); }

		let amountBdb: Int = paidUsdt / self.priceUsdtPerBdb;
		if (amountBdb <= 0) { throw(101); }
		if (amountBdb > self.remainingSupply) { throw(102); }

		if (self.bdbWallet == null) { throw(405); }
		let bdbWalletAddr = (self.bdbWallet!!);

		let bdbTransfer = beginCell()
			.storeUint(0x0f8a7ea5, 32)
			.storeUint(0, 64)
			.storeCoins(amountBdb)
			.storeAddress(buyer)
			.storeAddress(self.owner)
			.storeMaybeRef(null)
			.storeCoins(self.FORWARD_TON)
			.storeBit(1)
			.storeRef(beginCell().endCell())
			.endCell();

		send(SendParameters {
			to: bdbWalletAddr,
			value: self.WALLET_CALL_TON,
			bounce: true,
			body: bdbTransfer
		});

		// Forward received USDT to owner: transfer from our USDT wallet to owner
		let usdtForward = beginCell()
			.storeUint(0x0f8a7ea5, 32)
			.storeUint(0, 64)
			.storeCoins(paidUsdt)
			.storeAddress(self.owner)
			.storeAddress(self.owner)
			.storeMaybeRef(null)
			.storeCoins(self.FORWARD_TON)
			.storeBit(1)
			.storeRef(beginCell().endCell())
			.endCell();

		send(SendParameters {
			to: usdtWalletAddr,
			value: self.WALLET_CALL_TON,
			bounce: true,
			body: usdtForward
		});

		// Forward any attached TON dust to owner as well
		if (ctx.value > 0) {
			send(SendParameters {
				to: self.owner,
				value: ctx.value,
				bounce: false
			});
		}

		self.remainingSupply = self.remainingSupply - amountBdb;
	}
}