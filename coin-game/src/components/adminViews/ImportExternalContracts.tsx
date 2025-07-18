// @ts-nocheck
import { useEffect, useState } from 'react';
import { isAddress } from 'ethers';
import { Hex } from 'viem';

import { diamondFactoryAbi } from '../../contracts';
import useContracts from '../../hooks/useContracts';
import { useAppSelector } from '../../hooks/useReduxHooks';
import useSwal from '../../hooks/useSwal';
import useWeb3Tx from '../../hooks/useWeb3Tx';
import { validateInteger } from '../../utils/metamaskUtils';
import sockets from '../../utils/sockets';
import InputField from '../common/InputField';
import InputSelect from '../common/InputSelect';
import { rairSDK } from '../common/rairSDK';

const ImportExternalContract = () => {
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [resultData, setResultData] = useState<string>('');
  const [selectedBlockchain, setSelectedBlockchain] = useState<Hex | 'null'>(
    'null'
  );
  const [owner, setOwner] = useState<string>('');
  const [sendingData, setSendingData] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(0);
  const [progress, setProgress] = useState<number>();

  const reactSwal = useSwal();
  const { web3TxHandler, correctBlockchain, web3Switch } = useWeb3Tx();

  const { blockchainSettings } = useAppSelector((store) => store.settings);

  useEffect(() => {
    const report = (socketData) => {
      const { message, data } = socketData;
      const [progress, contractAddress, blockchain, creator, limit] = data;

      setSendingData(true);
      setProgress(progress);
      setResultData(message);
      setSelectedContract(contractAddress);
      setSelectedBlockchain(blockchain);
      setOwner(creator);
      setLimit(limit);
      if (progress === 100) {
        setSendingData(false);
      }
    };
    sockets.nodeSocket.on('importProgress', report);
    return () => {
      sockets.nodeSocket.off('importProgress', report);
    };
  }, []);

  const blockchainOptions = blockchainSettings
    .filter((chain) => chain.name && chain.hash)
    .map((chain) => {
      return {
        label: chain.name!,
        value: chain.hash!
      };
    });

  const { contractCreator } = useContracts();
  const { primaryButtonColor, secondaryButtonColor, textColor } =
    useAppSelector((store) => store.colors);

  const callImport = async () => {
    if (!validateInteger(limit)) {
      return;
    }
    setSendingData(true);

    const response = await rairSDK.contracts?.importContract({
      networkId: selectedBlockchain,
      contractAddress: selectedContract.toLowerCase(),
      limit,
      contractCreator: owner.toLowerCase()
    });
    if (response?.success) {
      reactSwal.fire(
        'Importing contract',
        'You can navigate away while the tokens are being imported',
        'info'
      );
    }
  };

  const tryToGetCreator = async () => {
    if (selectedBlockchain === 'null') {
      return;
    }
    if (!correctBlockchain(selectedBlockchain)) {
      web3Switch(selectedBlockchain);
      return;
    }
    if (!contractCreator) {
      return;
    }
    if (!isAddress(selectedContract)) {
      return;
    }
    const instance = await contractCreator(
      selectedContract as Hex,
      diamondFactoryAbi
    );
    if (instance) {
      const owner = await web3TxHandler(instance, 'owner', [], {
        intendedBlockchain: selectedBlockchain,
        failureMessage:
          'Failed to get creator, the contract might not use Ownable standard'
      });
      if (owner) {
        setOwner(owner.toString());
      } else {
        setOwner('');
      }
    }
  };

  return (
    <div className="col-12 row px-5">
      <div className="col-12 col-md-6">
        <InputSelect
          getter={selectedBlockchain}
          setter={setSelectedBlockchain}
          options={blockchainOptions}
          customClass="form-control"
          label="Blockchain"
          placeholder="Select a blockchain"
        />
      </div>
      <div className="col-12 col-md-6">
        <InputField
          getter={selectedContract}
          setter={setSelectedContract}
          label="Contract address"
          customClass="form-control"
          labelClass="col-12"
        />
      </div>
      <div className="col-12 col-md-3">
        <InputField
          getter={limit}
          setter={setLimit}
          label="Number of tokens to import (0 = all)"
          customClass="form-control"
          labelClass="col-12"
        />
      </div>
      <div className="col-12 col-md-6">
        <InputField
          getter={owner}
          setter={setOwner}
          label="Contract's owner"
          customClass="form-control"
          labelClass="col-12"
        />
      </div>
      <div className="col-12 col-md-3 pt-4 px-0 mx-0">
        <button
          disabled={!contractCreator || !isAddress(selectedContract)}
          style={{
            background: secondaryButtonColor,
            color: textColor
          }}
          className="btn rair-button w-100"
          onClick={tryToGetCreator}>
          Try to get owner address
        </button>
      </div>
      <hr />
      <button
        onClick={callImport}
        disabled={
          sendingData ||
          !validateInteger(limit) ||
          selectedBlockchain === 'null' ||
          !isAddress(selectedContract)
        }
        className="btn rair-button col-12"
        style={{
          background: primaryButtonColor,
          color: textColor
        }}>
        {sendingData ? 'Please wait...' : 'Import Contract!'}
      </button>
      <hr />
      <h5 className="text-center">{resultData}</h5>
      <br />
      {progress && <progress value={progress} max={100} />}
      <br />
    </div>
  );
};

export default ImportExternalContract;
