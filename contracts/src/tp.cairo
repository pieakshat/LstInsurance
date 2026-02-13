/// this is just a random file I use to get a better understanding of cairo 

#[starknet::contract]
mod SimpleStaking {
    use starknet::ContractAddress; 
    use starknet::get_caller_address; 

    #[storage]
    struct Storage {
        staking_token: ContractAddress, 
        balances: LegacyMap<ContractAddress, u256>, 
        total_staked: u256, 
    }

    #[constructor]
    fn constructor(
    ref self: ContractState, 
    token: ContractAddress 
    ) {
        self.staking_token.write(token); 
    }

    #[external]
    fn stake(
    ref self: ContractState, 
    amount: u256
    ) {
        let caller = get_caller_address(); 
        let token = self.staking_token.read(); 

        let erc20 = IERC20Dispatcher {  contract_address: token }; 

        erc20.transfer_from(
        caller, 
        starknet::get_contract_address(), 
        amount
        ); 

        let prev_balances = self.balances.read(caller); 
        let new_balance = prev_balances + amount; 

        self.balances.write(caller, new_balance); 

        let total = self.total_staked.read(); 
        self.total_staked.write(total + amount); 
    }

    #[external]
    fn unStake(
    ref self: ContractState, 
    amount: u256
    ) {
        let caller = get_caller_address(); 
        let token = self.staking_token.read(); 

        let erc20 = IERC20Dispatcher {  contract_address: token }; 

        let balance = self.balances.read(caller); 
        assert(balance >= amount, 'INSUFFICIENT_BALANCE'); 

        // Update balance 
        self.balances.write(caller, balance - amount); 

        let total = self.total_staked.read(); 
        self.total_staked.write(total - amount); 

        erc20.transfer(caller, amount); 
    }

    #[view]
    fn balance_of(
        self: @ContractState, 
        user: ContractAddress
    ) -> u256 {
        self.balances.read(user)
    }

    #[view]
    fn total_staked(
        self: @ContractState
    ) -> u256 {
        self.total_staked.read()
    }

}