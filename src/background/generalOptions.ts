import { BrowserStorage } from "./browserStorage"
import { 
	createDefaultGeneralOptionsData, GeneralOptionsData, plainToGeneralOptionsData, Theme, 
} from "./generalOptionsParser"
import { ChangedEvent, ListenerOf, Observer } from "./observer"

type ChangeObservers = {
	[Property in keyof Pick<GeneralOptionsData, "theme">]: 
		Observer<ChangedEvent<GeneralOptionsData[Property]>>
}

/**
 * Class for storing general options. Contains means for loading and saving to browser storage.
 */
export class GeneralOptions {
	private _data!: GeneralOptionsData
	private browserStorage: BrowserStorage

	/** Assigns browser storage and assigns data */
	private constructor(browserStorage: BrowserStorage, generalOptionsData?: GeneralOptionsData) {
		this.browserStorage = browserStorage
		this.assignData(generalOptionsData)
	}

	/**
	 * Creates and initializes a GeneralOptions.
	 * Loads general options data from browser storage.
	 * @param browserStorage
	 * @returns new instance of GeneralOptions
	 */
	static async create(browserStorage: BrowserStorage): Promise<GeneralOptions> {
		const instance = new GeneralOptions(
			browserStorage, await browserStorage.fetchGeneralOptionsData())
		return instance
	}

	/**
	 * Assigns new instance of general options data to this object.
	 * Pass undefined to get defaults.
	 * @param generalOptionsData 
	 * @Throws Error if data is invalid
	 */
	assignData(generalOptionsData?: GeneralOptionsData): void {
		if (generalOptionsData === undefined)
			this._data = createDefaultGeneralOptionsData()
		else
			this._data = plainToGeneralOptionsData(generalOptionsData)
	}

	get data(): GeneralOptionsData {
		return this._data
	}

	private readonly changeObservers: ChangeObservers = {
		theme: new Observer(),
	}

	/**
	 * Subscribe to changes of any allowed property in general options.
	 * @returns unsubscribe function
	 */
	subscribeChanged<K extends keyof ChangeObservers>(
		key: K, listener: ListenerOf<ChangeObservers[K]>): () => void {
		// For some reason subscribe doesn't allow this listener type even though 
		// it seems to be correct. Calling site type requirements work as expected.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this.changeObservers[key].subscribe(listener as any)
	}

	set theme(newValue: Theme) {
		this.data.theme = newValue
		this.changeObservers.theme.publish({ newValue })
	}
}