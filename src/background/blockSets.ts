import { BlockSet, BlockTestRes } from "./blockSet"
import { timeToMSSinceMidnight } from "../shared/utils"
import { BrowserStorage } from "./browserStorage"

/**
 * Loads blocksets from storage, maintains synchronization when modified. 
 * Has helper function for testing an url against all block sets simultaneously.
 */
export class BlockSets {

	private _list: BlockSet[] = []
	private browserStorage: BrowserStorage

	private constructor() {
		this.browserStorage = new BrowserStorage({ preferSync: true })
	}

	/**
	 * Creates and initializes a BlockSetManager.
	 * Loads setting from sync storage.
	 * @returns new instance of BlockSetManager
	 */
	static async create(): Promise<BlockSets> {
		const instance = new BlockSets()
		instance._list = await instance.browserStorage.loadBlockSets()
		// Create a single default block set if storage is empty
		if (instance._list.length === 0) 
			instance._list = [new BlockSet(0)]
		return instance
	}

	/**
	 * Return a list of block set ids that want to block this url.
	 * @param urlNoProtocol url to check against (no protocol allowed)
	 * @param channelId channel id to check against
	 * @param categoryId category id to check against
	 */
	blockedBy(urlNoProtocol: string, channelId: string | null, categoryId: string | null): number[] {
		const blockingBSIds: number[] = []

		const now = new Date()
		const msSinceMidnight = timeToMSSinceMidnight(now)
		const weekDay = now.getDay()
		for (const blockSet of this._list) {
			// if today is not an active day or not in active hours
			if (!blockSet.isInActiveWeekday(weekDay) || !blockSet.isInActiveTime(msSinceMidnight)) 
				continue

			const blockResult = blockSet.test(urlNoProtocol, channelId, categoryId)

			if (blockResult === BlockTestRes.Blacklisted) {
				blockingBSIds.push(blockSet.id)
			}
		}
		return blockingBSIds
	}

	get list(): BlockSet[] {
		return this._list
	}

	/** Returns list of block set ids in the order they should appear in UI */
	getIds(): number[] {
		return this._list.map((bs) => bs.id)
	}

	/**
	 * Add a new block set to the end of the list with default values.
	 * Id will be automatically assigned.
	 * @returns added block set
	 * @throws "Can't save item, it is too large" when size quota is exceeded
	 * @throws "Can't save item, too many write operations" when write operations quota is exceeded
	 */
	async addDefaultBlockSet(): Promise<BlockSet> {
		const newBlockSet = new BlockSet(this.findNextSafeId())
		newBlockSet.name = this.computeNewName()
		await this.browserStorage.saveNewBlockSet(newBlockSet, [...this.getIds(), newBlockSet.id])
		this._list.push(newBlockSet)
		return newBlockSet
	}

	/**
	 * Add a new block set to the end of the list with values copied from copyFrom.
	 * timeElapsed will be set to zero and id will be automatically assigned.
	 * (copy) will be appended to the end of the name.
	 * @param copyFrom block set to get values from
	 * @returns added block set
	 * @throws "Can't save item, it is too large" when size quota is exceeded
	 * @throws "Can't save item, too many write operations" when write operations quota is exceeded
	 */
	async addBlockSetCopy(copyFrom: BlockSet): Promise<BlockSet> {
		const newBlockSet = new BlockSet(this.findNextSafeId(), copyFrom.data)
		newBlockSet.name = this.computeCopyName(copyFrom.name)
		await this.browserStorage.saveNewBlockSet(newBlockSet, [...this.getIds(), newBlockSet.id])
		this._list.push(newBlockSet)
		return newBlockSet
	}

	/** Returns the smallest block set id that is >= 0 and unused. */
	private findNextSafeId() {
		const currentIds = this.getIds()
		let nextSafeId = 0
		while(currentIds.indexOf(nextSafeId) > -1) {
			nextSafeId += 1
		}
		return nextSafeId
	}

	/**
	 * Returns copy oldName with "(copy)" appended.
	 * If oldName already ends with "(copy)", then replace it with "(copy2x)", then "(copy3x)".
	 * Continues in this fashion for further copies.
	 * @param oldName 
	 */
	private computeCopyName(oldName: string): string {
		const regexRes = /\(copy(?:(\d{1,})x)?\)$/.exec(oldName)
		if (regexRes === null) {
			return `${ oldName } (copy)`
		}
		
		const copyNumberStr = regexRes[1]
		const copyIndex = regexRes.index
		const copyNumber = copyNumberStr !== undefined ? parseInt(copyNumberStr, 10) : 1

		return `${oldName.substring(0, copyIndex)}(copy${copyNumber + 1}x)`
	}

	
	/**
	 * Returns "Block Set ${number larger than any that already exist}", starting from 1
	 * E.g. if there exists block set with name "Block Set 7", 
	 * and no larger numbers exist, then this will return "Block Set 8".
	 * In that case 1 will not be chosen, even if it is technically "free".
	 */
	private computeNewName(): string {
		let largestNumber = 0
		for (const blockSet of this._list) {
			const regexRes = /^Block Set (\d{1,})$/.exec(blockSet.name)
			if (regexRes !== null) {
				const number = parseInt(regexRes[1] as string, 10)
				largestNumber = Math.max(largestNumber, number)
			}
		}

		return `Block Set ${largestNumber + 1}`
	}
}