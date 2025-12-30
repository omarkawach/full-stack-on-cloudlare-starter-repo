interface DestinationStatusEvaluationParams {
	linkId: string;
	destinationUrl: string;
	accountId: string;
}

interface Env extends Cloudflare.Env {
	// Override workflows for evaluation scheduler alarm
	DESTINATION_EVALUATION_WORKFLOW: Workflow<DestinationStatusEvaluationParams>;
}
