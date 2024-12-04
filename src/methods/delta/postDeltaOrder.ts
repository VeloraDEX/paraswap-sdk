import { API_URL } from '../../constants';
import type { ConstructFetchInput } from '../../types';
import { DeltaAuctionOrder, ParaswapDeltaAuction } from './helpers/types';

export type DeltaOrderToPost = {
  /** @description Partner string */
  partner?: string;
  order: DeltaAuctionOrder;
  /** @description Signature of the order from order.owner address. EOA signatures must be submitted in ERC-2098 Compact Representation. */
  signature: string;
  chainId: number;
  /** @description designates the Order as being able to partilly filled, as opposed to fill-or-kill */
  partiallyFillable?: boolean;
};

export type PostDeltaOrderParams = Omit<DeltaOrderToPost, 'chainId'>;

type DeltaOrderApiResponse = ParaswapDeltaAuction;

type PostDeltaOrder = (
  postData: PostDeltaOrderParams,
  signal?: AbortSignal
) => Promise<DeltaOrderApiResponse>;

export type PostDeltaOrderFunctions = {
  postDeltaOrder: PostDeltaOrder;
};

export const constructPostDeltaOrder = ({
  apiURL = API_URL,
  chainId,
  fetcher,
}: ConstructFetchInput): PostDeltaOrderFunctions => {
  const postOrderUrl = `${apiURL}/delta/orders` as const;

  const postDeltaOrder: PostDeltaOrder = (postData, signal) => {
    const deltaOrderToPost: DeltaOrderToPost = { ...postData, chainId };

    return fetcher<DeltaOrderApiResponse>({
      url: postOrderUrl,
      method: 'POST',
      data: deltaOrderToPost,
      signal,
    });
  };

  return { postDeltaOrder };
};
