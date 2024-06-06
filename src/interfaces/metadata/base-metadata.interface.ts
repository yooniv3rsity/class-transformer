export interface BaseMetadata { 
	target: Function; 
	/**
	 * The property name this metadata belongs to on the target (class or property).
	 *
	 * Note: If the decorator is applied to a class the propertyName will be undefined.
	 */
	propertyName: string|undefined; // undefined if class-level metadata
}