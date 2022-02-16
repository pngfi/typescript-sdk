import { BondingInfo, Token, } from '../types';
import {
    Bonding,
    Staking
} from '../models';
import {
    DecimalUtil,
    getTokenByMint,
    getTokenBySymbol,
} from '../utils';
import Decimal from 'decimal.js';
import { u64 } from '@solana/spl-token';

interface BondingFormatProps {
    bondingModel: Bonding;
    bondingInfo: BondingInfo & {
        originMint: string;
        initSupply: u64;
    };
    allTokens: any,
    allTokenPrices: any,
    allStakingModel: any,
}

interface BondingFormatReturn {
    bondingModel: Bonding,
    stakingModel: Staking,
    vestTerm: number,
    roi: number | null,
    maxPayout: number,
    tbv: number,
    marketPrice: number,
    bondingPrice: number,
    payoutAsset: {
        icon: string,
        symbol: string,
    },
    depositAsset: {
        symbol: any,
        icon?: any[],
        isLp: boolean,
        decimal: any
    } | null
}

export const BondingFormat = ({
    bondingModel,
    bondingInfo,
    allTokens,
    allTokenPrices,
    allStakingModel
}: BondingFormatProps): BondingFormatReturn | null => {

    if (!bondingInfo) return null;

    const depositToken: any = allTokens.length && bondingInfo ?
        getTokenByMint(bondingInfo.depositTokenMint.toString(), allTokens) : null;

    const payoutToken: any | null | undefined = allTokens.length && bondingInfo ? getTokenByMint(bondingInfo.originMint, allTokens) : null;

    const vestTerm = bondingInfo ? bondingInfo.vestConfigInfo.claimAllDuration / (3600 * 24) : 0

    const assetTokens = () => {
        if (!depositToken) {
            return null;
        }
        if (depositToken?.isLP) {
            const tmpArr = depositToken?.symbol.split('_') || [];
            const tokenA: Token | undefined = getTokenBySymbol(tmpArr[0], allTokens);
            const tokenB: Token | undefined = getTokenBySymbol(tmpArr[1], allTokens);
            return {
                isLp: true,
                symbol: `${tokenA?.symbol}_${tokenB?.symbol}`,
                icon: [tokenA?.logoURI, tokenB?.logoURI],
                decimal: depositToken.decimals
            }
        } else {
            return {
                isLp: false,
                symbol: depositToken.symbol,
                icon: [depositToken.logoURI],
                decimal: depositToken.decimals
            };
        }
    };

    const payoutInfo = bondingModel ? bondingModel.calcPayout(
        bondingInfo, payoutToken.decimals, depositToken.decimals
    ) : null;

    const payoutTokenPrice = allTokenPrices[payoutToken.symbol] || 0;

    const depositTokenPrice = allTokenPrices[depositToken.symbol] || 0;

    const bondingPrice = payoutInfo ?
        new Decimal(depositTokenPrice)
            .div(
                DecimalUtil.fromU64(payoutInfo.payoutAmount, payoutToken.decimals)
            ).toNumber() : 0;

    const roi = bondingPrice > 0 ? (payoutTokenPrice - bondingPrice) * 100 / bondingPrice : null;

    const tbv = (DecimalUtil.fromU64(
        bondingInfo.bondingSupply.sub(bondingInfo.initSupply),
        payoutToken?.decimals
    ).mul(payoutTokenPrice)).toNumber();

    const maxPayout = (DecimalUtil.fromU64(bondingInfo.bondingSupply, 6)
        .mul(DecimalUtil.fromU64(bondingInfo.maxPayoutFactor))
        .div(DecimalUtil.fromNumber(100000))).toNumber();

    const stakingModel = allStakingModel.map((s: any) => s.stakingModel).find((item: any) => {
        if (!item) return null;
        return item.config.address.equals(bondingInfo.stakingPubkey);
    }) ?? null;

    return {
        bondingModel,
        stakingModel,
        vestTerm,
        roi,
        maxPayout,
        tbv,
        marketPrice: payoutTokenPrice,
        bondingPrice,
        payoutAsset: {
            icon: payoutToken?.logoURI,
            symbol: payoutToken?.symbol,
        },
        depositAsset: assetTokens()
    }
}