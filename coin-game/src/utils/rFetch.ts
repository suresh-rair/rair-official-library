// import { Web3AuthSigner } from '@alchemy/aa-signers/web3auth';
import { Intents } from '@rair-protocol/sdk/src/types/auth';
import { BrowserProvider, Provider } from 'ethers';
import Swal from 'sweetalert2';
import { Hex } from 'viem';

import { rairSDK } from '../components/common/rairSDK';

const signIn = async (provider: Provider) => {
  //let currentUser = await (provider as JsonRpcProvider).getSigner(0);
  if (!provider && window.ethereum) {
    provider = new BrowserProvider(window.ethereum);
  }
  const responseData = await rairSDK.auth?.currentUser();

  if (responseData?.success && responseData.user) {
    const loginResponse = await signWeb3MessageMetamask(
      responseData.user.publicAddress!
    );
    return loginResponse?.success;
  }
};

const getChallenge = async (userAddress: Hex, ownerAddress?: Hex) => {
  const responseData = await rairSDK.auth?.getChallenge({
    userAddress,
    intent: Intents.Login,
    ownerAddress: ownerAddress || userAddress
  });

  return responseData?.response;
};

const respondChallenge = async (challenge, signedChallenge, userAddress) => {
  // const loginResponse = await rFetch('/api/auth/login', {
  //   method: 'POST',
  //   body: JSON.stringify({
  //     MetaMessage: JSON.parse(challenge).message.challenge,
  //     MetaSignature: signedChallenge,
  //     method: 'metamask'
  //   }),
  //   headers: {
  //     'Content-Type': 'application/json'
  //   }
  // });

  const responseData = await rairSDK.auth?.loginWeb3({
    MetaMessage: JSON.parse(challenge).message.challenge,
    MetaSignature: signedChallenge,
    method: 'metamask'
  });

  if (!responseData) {
    Swal.fire('Error', `Login failed`, 'error');
    return;
  }
  return { success: responseData.user ? true : false, user: responseData.user };
};

const signWeb3MessageMetamask = async (userAddress: Hex) => {
  const challenge = await getChallenge(userAddress);
  if (window.ethereum) {
    const ethRequest = {
      method: 'eth_signTypedData_v4',
      params: [userAddress, challenge],
      from: userAddress
    };
    const signedChallenge = await window?.ethereum?.request(ethRequest);
    if (signedChallenge) {
      return await respondChallenge(challenge, signedChallenge, userAddress);
    }
  }
};

// const signWeb3MessageAlchemyV4 = async (userAddress: Hex, signer) => {
//   if (!signer) {
//     return;
//   }

//   const challenge = await getChallenge(userAddress);

//   const parsedResponse = JSON.parse(challenge);
//   const signedChallenge = await signer.signTypedData(parsedResponse);

//   if (signedChallenge) {
//     return await respondChallenge(challenge, signedChallenge);
//   }
// };

// const signWeb3MessageWeb3Auth = async (userAddress: Hex) => {
//   const web3AuthSigner = new Web3AuthSigner({
//     clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID,
//     chainConfig: {
//       chainNamespace: 'eip155'
//     }
//   });

//   await web3AuthSigner.authenticate({
//     init: async () => {
//       await web3AuthSigner.inner.initModal();
//     },
//     connect: async () => {
//       await web3AuthSigner.inner.connect();
//     }
//   });

//   const challenge = await getChallenge(
//     userAddress,
//     await web3AuthSigner.getAddress()
//   );

//   const parsedResponse = JSON.parse(challenge);
//   const signedChallenge = await web3AuthSigner.signTypedData(parsedResponse);
//   const loginResponse = await rFetch('/api/auth/loginSmartAccount', {
//     method: 'POST',
//     body: JSON.stringify({
//       MetaMessage: parsedResponse.message.challenge,
//       MetaSignature: signedChallenge,
//       userAddress: userAddress
//     }),
//     headers: {
//       'Content-Type': 'application/json'
//     }
//   });
//   // eslint-disable-next-line no-case-declarations
//   const { success, user } = loginResponse;
//   if (!success) {
//     Swal.fire('Error', `Web3Login failed`, 'error');
//     return;
//   }
//   return { success, user };
// };

const rFetch = async (
  route: string,
  options?: RequestInit,
  retryOptions: any = undefined,
  showErrorMessages = true
) => {
  const request = await fetch(route, {
    ...options,
    headers: {
      ...options?.headers
    }
  });
  try {
    const parsing = await request.json();
    if (!parsing.success) {
      if (
        [
          'jwt malformed',
          'jwt expired',
          'invalid signature',
          'Authentication failed, please login again'
        ].includes(parsing.message) &&
        (window.ethereum || retryOptions?.provider)
      ) {
        localStorage.removeItem('token');
        const retry = await signIn(retryOptions?.provider);
        if (retry) {
          return rFetch(route, options);
        }
      }
      if (showErrorMessages) {
        Swal.fire('Error', parsing?.message, 'error');
      }
    }
    return parsing;
  } catch (err) {
    console.error(request, err);
  }
  return request;
};

export { rFetch, signIn, signWeb3MessageMetamask };
