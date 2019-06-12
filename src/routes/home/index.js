import { h, Component } from 'preact';
import style from './style';
import { dapp } from 'dapp-wallet-util';

import {Contracts} from '@zilliqa-js/contract';
import {Zilliqa} from '@zilliqa-js/zilliqa';
import { fromBech32Address, toBech32Address, getAddressFromPublicKey } from "@zilliqa-js/crypto";
import { Transaction } from '@zilliqa-js/account';
const { BN, Long, bytes, units } = require('@zilliqa-js/util');



export default class Home extends Component {
	constructor(props) {
		super(props);

		this.state = {
			random: undefined,
			loadingInstance: true,
			instanceError: false,
			moonlet: undefined,
			zilliqa: undefined,
			accountConnected: false
		};

		this.fetchWalletInstance();
	}

	fetchWalletInstance() {
		this.setState({loadingInstance: true, instanceError: false});
		dapp.getWalletInstance('moonlet').then((moonlet) => {
			// create Zilliqa instance
			const zilliqa = new Zilliqa('', moonlet.providers.zilliqa);

			// apply a hack to disable internal ZilliqaJS autosigning feature
			zilliqa.blockchain.signer = zilliqa.contracts.signer = {
				sign: m => m
			};;

			this.setState({moonlet, zilliqa, loadingInstance: false});
		}, (instanceError) => {
			console.log(instanceError);
			this.setState({loadingInstance: false, instanceError});
		});
	}

	async onConnectClick() {
		this.state.moonlet.providers.zilliqa.getAccounts().then(accounts => {
			this.setState({accountConnected: true});
		});
	}

	renderErrors() {
		if (!this.state.loadingInstance && this.state.instanceError) {
			switch (this.state.instanceError) {
				case 'WALLET_NOT_INSTALLED':
					// moonlet is not installed, show a relevant message
					return <p>
						It seems you don't have moonlet wallet installed. <br/><br/>
						<a href="https://chrome.google.com/webstore/detail/moonlet-wallet/aepcjklheilpnnokjfpgncfcdakhbgci" target="_blank">Install Moonlet Wallet</a>
					</p>;
				case 'USER_DID_NOT_GRANT_PERMISSION':
					// the user did not grant permission for Moonlet to inject the content scripts to dApp website
					return <p>
						You did not grant access on this page for Moonlet Wallet. <br/><br/>
						You have to let Moonlet Wallet to access this page in order to continue.<br/><br/>
						<button onClick={this.fetchWalletInstance.bind(this)}>Grant permission</button>
					</p>;
				default: 
					// Other error, not quite relevant for now...
					return <p>
						There was an error while loading moonlet wallet instance.
					</p>;
			}
		}
	}

	render() {
		return (
			<div class={style.home}>
				<h1>dApp Example</h1>

				{/* Wallet instance is loading, display loader */}
				{this.state.loadingInstance && <p>Loading wallet instance...</p>}

				{/* Handle errors */}
				{this.renderErrors()}
				
				{/* Wallet instance loaded, permission was granted, but the user did not connect to an account */}
				{!this.state.loadingInstance && !this.state.instanceError && !this.state.accountConnected && <p>
					<button onClick={this.onConnectClick.bind(this)}>Connect with Moonlet</button>
				</p>}

				{/* everything is fine, dApp is connected to Moonlet, and it has access to an account  */}
				{this.state.accountConnected && <div>
					{/* Examples of basic operations calls */}
					<button onClick={() => {
						this.state.zilliqa.blockchain.getBlockChainInfo().then(this.genericRPCHandler);
					}}>Get Blockchain Info</button>
					<button onClick={() => {
						this.state.zilliqa.blockchain.getShardingStructure().then(this.genericRPCHandler);
					}}>Get Sharding Structure</button>
					<button onClick={() => {
						this.state.zilliqa.blockchain.getLatestDSBlock().then(this.genericRPCHandler);
					}}>Get Latest DS Block</button>
					<br/><br/>

					{/* Display current selected account info */}
					<div>Connected Account (bech32): {this.state.moonlet.providers.zilliqa.currentAccount}</div>
					<div>Connected Account (old): {fromBech32Address(this.state.moonlet.providers.zilliqa.currentAccount)}</div>
					<div>Connected Chain ID: {this.state.moonlet.providers.zilliqa.currentNetwork}</div>

					{/* trigger to force user to select an account, this could be used to implement a switch account feature */}
					<button onClick={() => {
						this.state.moonlet.providers.zilliqa.getAccounts(true).then(accounts => {
							this.setState({random: Math.random(), accountConnected: true});
						});
					}}>Switch account</button>

					{/* Get balance for current account call */}
					{/* Note: for now zilliqa.blockchain.getBalance doesn't support bech32 address format, so the dApp should do this transformation, for now */}
					<button onClick={() => {
						this.state.zilliqa.blockchain.getBalance(fromBech32Address(this.state.moonlet.providers.zilliqa.currentAccount)).then(this.genericRPCHandler);
					}}>Get Current Account Balance</button>

					<br/><br/>
					{/* Create transaction example */}
					{/* Note: the fields version, nonce and pubKey are ignored, Moonlet will fill them automatically based on current network and current account */}
					<button onClick={async () => {
						const tx = await this.state.zilliqa.blockchain.createTransaction(
							new Transaction({
								toAddr: 'zil1arczrdu3e7xvgvqd98rrj9mdfyrysc7eecshc3',
								amount: new BN(units.toQa("1", units.Units.Zil)),
								gasPrice: units.toQa('1000', units.Units.Li),
								gasLimit: Long.fromNumber(1)
							}, this.state.moonlet.providers.zilliqa)
						);

						console.log('Transaction', tx);

					}}>Do transfer</button>

					<br/><br/>
					{/* Contract interaction example */}
					<button onClick={this.deployContract.bind(this)}>Deploy Contract</button>
				</div>}
			</div>
		);
	}

	async deployContract() {
		// try {
			// Deploy a contract
			const code = `scilla_version 0

			(* HelloWorld contract *)
		
			import ListUtils
		
			(***************************************************)
			(*               Associated library                *)
			(***************************************************)
			library HelloWorld
		
			let not_owner_code = Int32 1
			let set_hello_code = Int32 2
		
			(***************************************************)
			(*             The contract definition             *)
			(***************************************************)
		
			contract HelloWorld
			(owner: ByStr20)
		
			field welcome_msg : String = ""
		
			transition setHello (msg : String)
			is_owner = builtin eq owner _sender;
			match is_owner with
			| False =>
				e = {_eventname : "setHello()"; code : not_owner_code};
				event e
			| True =>
				welcome_msg := msg;
				e = {_eventname : "setHello()"; code : set_hello_code};
				event e
			end
			end
		
		
			transition getHello ()
				r <- welcome_msg;
				e = {_eventname: "getHello()"; msg: r};
				event e
			end`;
		
			const init = [
			// this parameter is mandatory for all init arrays
			{
				vname: "_scilla_version",
				type: "Uint32",
				value: "0"
			},
			{
				vname: "owner",
				type: "ByStr20",
				// NOTE: all byte strings passed to Scilla contracts _must_ be
				// prefixed with 0x. Failure to do so will result in the network
				// rejecting the transaction while consuming gas!
				value: fromBech32Address(this.state.moonlet.providers.zilliqa.currentAccount)
			}
			];
		
			// Instance of class Contract
			const contract = this.state.zilliqa.contracts.new(code, init);
		
			// Deploy the contract
			const [deployTx, hello] = await contract.deploy({
				gasPrice: units.toQa('1000', units.Units.Li),
				gasLimit: Long.fromNumber(10000)
			});
		
			// Contract address resolution is not working correctly on ZilliqaJS when using a provider
			const txInfo = await this.state.zilliqa.blockchain.getTransaction(deployTx.id);
			const contractAddress = Contracts.getAddressForContract({
				senderAddress: getAddressFromPublicKey(txInfo.pubKey.replace('0x', '')),
				txParams: {
					nonce: txInfo.nonce
				}
			});
			hello.address = contractAddress;

			
			// Introspect the state of the underlying transaction
			console.log(`Deployment Transaction ID: ${deployTx.id}`);
			console.log(`Deployment Transaction Receipt:`);
			console.log(deployTx);
		
			// Get the deployed contract address
			console.log("The contract address is:");
			console.log(hello.address);

			// invoke contract method
			const callTx = await hello.call(
			"setHello",
			[
				{
				vname: "msg",
				type: "String",
				value: "Hello World"
				}
			],
			{
				// amount, gasPrice and gasLimit must be explicitly provided
				//version: VERSION,
				amount: new BN(0),
				gasPrice: units.toQa('1000', units.Units.Li),
				gasLimit: Long.fromNumber(8000),
			}
			);
			console.log(callTx);
		
			//Get the contract state
			const state = await hello.getState();
			console.log("The state of the contract is:");
			console.log(state);
		// } catch (err) {
		// 	console.log(err);
		// }
	}

	genericRPCHandler(data) {
		console.log(data);
		if (data.error) {
			alert(data.error.message);
		} else {
			alert(JSON.stringify(data.result, null, 4));
		}
	}
}
