
// Jetton Sale Contract for BIDEBA Coin (BDB)
import "@stdlib/jetton/jetton-transfer.func";

contract JettonSale {
    address owner;
    address jetton_wallet;
    address jetton_master;
    int price_per_token; // в nanotons

    init(owner_: address, jetton_wallet_: address, jetton_master_: address, price_per_token_: int) {
        owner = owner_;
        jetton_wallet = jetton_wallet_;
        jetton_master = jetton_master_;
        price_per_token = price_per_token_;
    }

    receive("ton::transfer") {
        address buyer = msg.sender;
        int received_ton = msg.value;

        ;; Рассчитываем, сколько токенов нужно отправить
        int tokens_to_send = received_ton / price_per_token;

        ;; Формируем payload для отправки jetton
        slice payload = jetton_transfer_message(
            query_id: 0,
            amount: tokens_to_send,
            destination: buyer,
            response_destination: null(),
            custom_payload: null(),
            forward_ton_amount: 0,
            forward_payload: null()
        );

        ;; Отправляем Jettons
        send_raw_message(
            to: jetton_wallet,
            value: 0.2,
            mode: 1,
            body: payload
        );
    }
}
