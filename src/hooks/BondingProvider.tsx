import React, { useState, createContext, useContext, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { PublicKey } from '@solana/web3.js';
import { DecimalUtil, BondingFormat } from '../utils';
import { Bonding, Staking } from '../models';
import { u64 } from '@solana/spl-token';
import type { Provider } from "@saberhq/solana-contrib";

export interface BondingArgs {
    provider: Provider,
    cluster: string
}

type BondingPorps = BondingArgs & {
    children: ReactNode
}

export const BondingContext = createContext<any>(undefined);

export const BondingProvider: React.FC<BondingPorps> = ({
    children,
    provider,
    cluster
}) => {

    const [bondingInfo, setBondingInfo] = useState();
    const [fetchInfo, setFetchInfo] = useState<any>();

    const fetchAllInfo = async () => {
        // const API_HOST = 'https://api.png.fi';
        const API_HOST = cluster === 'mainnet-bate' ? 'https://api.png.fi' : '';

        const bondingRes = await axios.get(`${API_HOST}/bonding`);
        const bondingList = (bondingRes.data ?? []).map((item: any) => toBondingInfo(item));

        const stakingRes = await axios.get(`${API_HOST}/staking`);
        const stakingList = (stakingRes.data ?? []).map((item: any) => toStakingInfo(item));

        const tokensRes = await axios.get(`${API_HOST}/tokens`);
        const allTokens = tokensRes.data ?? [];

        const poolsRes = await axios.get(`${API_HOST}/pools`);
        const poolsInfo = (poolsRes.data ?? []).map((item: any) => toPoolInfo(item));
        const pairs = poolsInfo.map((item: any) => {
            return `${item?.tokenA.symbol}_${item?.tokenB.symbol}`;
        });

        const idsArr = [...new Set(
            pairs.map((pair: any) => pair.split('_')).flat(Infinity)
        ) as any];

        const tokenPricesRes = await axios.get(`${API_HOST}/prices/${idsArr.concat(pairs).join(',')}`);
        const allTokenPrices = tokenPricesRes.data;

        setFetchInfo({
            bondingList,
            stakingList,
            allTokens,
            allTokenPrices
        })
    }
    const toBondingInfo = (item: any) => {
        if (!item) return;

        const {
            pubkey,
            stakingAddress,
            payoutHolder,
            bondingSupply,
            controlVariable,
            decayFactor,
            depositHolder,
            depositHolderAmount,
            depositTokenMint,
            initSupply,
            lastDecay,
            maxDebt,
            maxPayoutFactor,
            minPrice,
            payoutTokenMint,
            totalDebt,
            vestConfigInfo
        } = item;

        return {
            pubkey: new PublicKey(pubkey),
            stakingPubkey: new PublicKey(stakingAddress),
            payoutHolder: new PublicKey(payoutHolder),
            payoutTokenMint: new PublicKey(payoutTokenMint),
            depositHolder: new PublicKey(depositHolder),
            depositTokenMint: new PublicKey(depositTokenMint),
            depositHolderAmount: DecimalUtil.toU64(DecimalUtil.fromString(depositHolderAmount)),
            initSupply: DecimalUtil.toU64(DecimalUtil.fromString(initSupply)),
            bondingSupply: DecimalUtil.toU64(DecimalUtil.fromString(bondingSupply)),
            maxPayoutFactor: DecimalUtil.toU64(DecimalUtil.fromString(maxPayoutFactor)),
            maxDebt: DecimalUtil.toU64(DecimalUtil.fromString(maxDebt)),
            minPrice: DecimalUtil.toU64(DecimalUtil.fromString(minPrice)),
            totalDebt: DecimalUtil.toU64(DecimalUtil.fromString(totalDebt)),
            controlVariable,
            decayFactor,
            lastDecay,
            vestConfigInfo
        }
    }
    const toStakingInfo = (item: any) => {
        if (!item) return;

        const {
            pubkey,
            tokenMint,
            sTokenMint,
            tokenHolder,
            tokenHolderAmount,
            rebaseEpochDuration,
            rebaseLastTime,
            rebaseRateNumerator,
            rebaseRateDenominator,
            rebaseRewardsAmount,
            rewardsHolder,
            rebaseSupply,
            apy,
            rewardsPerDay,
            sTokenMintSupply,
            vestConfigInfo
        } = item;

        return {
            pubkey: new PublicKey(pubkey),
            tokenMint: new PublicKey(tokenMint),
            sTokenMint: new PublicKey(sTokenMint),
            tokenHolder: new PublicKey(tokenHolder),
            payoutTokenMint: new PublicKey(tokenHolder),
            tokenHolderAmount: DecimalUtil.toU64(DecimalUtil.fromString(tokenHolderAmount)),
            rebaseEpochDuration,
            rebaseLastTime,
            apy,
            rewardsPerDay,
            rebaseRateNumerator,
            rebaseRateDenominator,
            rewardsHolder: new PublicKey(rewardsHolder),
            rebaseSupply: DecimalUtil.toU64(DecimalUtil.fromString(rebaseSupply)),
            sTokenMintSupply: DecimalUtil.toU64(DecimalUtil.fromString(sTokenMintSupply)),
            rebaseRewardsAmount: DecimalUtil.toU64(DecimalUtil.fromString(rebaseRewardsAmount)),
            vestConfigInfo: {
                pubkey: new PublicKey(vestConfigInfo.pubkey),
                vestMint: new PublicKey(vestConfigInfo.vestMint),
                claimAllDuration: vestConfigInfo.claimAllDuration,
                halfLifeDuration: vestConfigInfo.halfLifeDuration,
                claimableHolder: new PublicKey(vestConfigInfo.claimableHolder),
                claimableMint: new PublicKey(vestConfigInfo.claimableMint),
            }
        }
    }
    const toPoolInfo = (item: any) => {

        const {
            pubkey,
            authority,
            curveType,
            feeAccount,
            feeStructure,
            lpSupply,
            nonce,
            poolTokenDecimals,
            poolTokenMint,
            tokenA,
            tokenB
        } = item;

        return {
            address: new PublicKey(pubkey),
            authority: new PublicKey(authority),
            curveType,
            feeAccount: new PublicKey(feeAccount),
            feeStructure,
            lpSupply: DecimalUtil.fromString(lpSupply),
            nonce,
            poolTokenDecimals,
            poolTokenMint: new PublicKey(poolTokenMint),
            tokenA: {
                ...tokenA,
                addr: new PublicKey(tokenA.addr),
                amount: new u64(tokenA.amount)
            },
            tokenB: {
                ...tokenB,
                addr: new PublicKey(tokenB.addr),
                amount: new u64(tokenB.amount)
            }

        }
    }

    useEffect(() => {
        fetchAllInfo();
    }, []);

    useEffect(() => {
        if (!!!fetchInfo) return;

        const { bondingList, stakingList, allTokens, allTokenPrices } = fetchInfo;
        const allBonding = bondingList.map((info: any) => {
            return {
                bondingModel: provider ?
                    new Bonding(provider as any, { address: info.pubkey }, info) : null,
                bondingInfo: Object.assign({}, info, {
                    originMint: allTokens.find((item: any) => item.mint === info.payoutTokenMint.toBase58())?.originMint
                })
            }
        });

        const allStakingModel = stakingList.map((info: any) => {
            return {
                stakingModel: provider ?
                    new Staking(
                        provider as any,
                        { address: info.pubkey, vestConfig: info.vestConfigInfo.pubkey },
                        info
                    ) : null
            }
        });

        const bondingInfo = allBonding.map((item: any) => {
            const { bondingModel, bondingInfo } = item;
            return BondingFormat({
                bondingModel,
                bondingInfo,
                allTokens,
                allTokenPrices,
                allStakingModel
            })
        });
        setBondingInfo(bondingInfo);

    }, [fetchInfo, provider]);

    return (
        <BondingContext.Provider value={{
            bondingInfo
        }}>
            {children}
        </BondingContext.Provider>
    );
}

export const useBonding = () => {
    const useContainer = useContext(BondingContext);
    return useContainer;
}