

export class RecursionStack {
	private stack = new Set<Record<string, any>>();

	constructor(private enabled:boolean) {}

	add(value:any) {
		if(this.enabled) this.stack.add(value)
	}

	delete(value:any) {
		if(this.enabled) this.stack.delete(value)
	}

	has(value:any) {
		if(!this.enabled) return false;
		return this.stack.has(value)
	}
}