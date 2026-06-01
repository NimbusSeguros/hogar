import { InsuranceProvider } from '../../interfaces/InsuranceProvider';
import { RusProvider } from './rus/RusProvider';

export class InsuranceProviderFactory {
    static getProvider(providerName: string): InsuranceProvider {
        switch (providerName.toUpperCase()) {
            case 'RUS':
                return new RusProvider();
            // In the future:
            // case 'SAN_CRISTOBAL':
            //     return new SanCristobalProvider();
            // case 'EXPERTA':
            //     return new ExpertaProvider();
            default:
                throw new Error(`Provider ${providerName} is not supported.`);
        }
    }
}
