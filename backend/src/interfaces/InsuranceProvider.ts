export interface InsuranceProvider {
    /**
     * Authenticate and initialize the provider session, usually fetching an access token.
     */
    authenticate(): Promise<void>;

    /**
     * Returns an array of insurable objects (e.g. VIVIENDA, AUTOMOVIL)
     * @param campaignCode Campaign string code or ID
     */
    getObjects(campaignCode: string): Promise<any[]>;

    /**
     * Obtains the specific insurable object details.
     */
    getObject(campaignCode: string, objectCode: string): Promise<any>;

    /**
     * Start the quote process by initializing the interactive form.
     */
    startInteractiveForm(campaignCode: string, objectCode: string, symptomCode: string): Promise<any>;

    /**
     * Submit an answer for the interactive form and receive the next question (or alerts).
     */
    submitAnswer(campaignCode: string, objectCode: string, symptomCode: string, queryId: string, answers: any): Promise<any>;

    /**
     * Get the available plans after finishing the interactive questionnaire
     */
    getPlans(campaignCode: string, queryId: string): Promise<any[]>;
}
