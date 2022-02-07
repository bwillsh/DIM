import { settingSelector } from 'app/dim-api/selectors';
import ClassIcon from 'app/dim-ui/ClassIcon';
import { startFarming } from 'app/farming/actions';
import { t } from 'app/i18next-t';
import { InventoryBuckets } from 'app/inventory/inventory-buckets';
import { DimItem } from 'app/inventory/item-types';
import {
  allItemsSelector,
  bucketsSelector,
  hasClassifiedSelector,
  storesSelector,
  profileResponseSelector,
} from 'app/inventory/selectors';
import { editLoadout } from 'app/loadout-drawer/loadout-events';
import MaxlightButton from 'app/loadout-drawer/MaxlightButton';
import { ItemFilter } from 'app/search/filter-types';
import { LoadoutSort } from 'app/settings/initial-settings';
import { RootState, ThunkDispatchProp } from 'app/store/types';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import _ from 'lodash';
import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { createSelector } from 'reselect';
import { DimStore } from '../inventory/store-types';
import { showNotification } from '../notifications/notifications';
import { filteredItemsSelector, searchFilterSelector } from '../search/search-filter';
import {
  addIcon,
  AppIcon,
  banIcon,
  editIcon,
  engramIcon,
  faExclamationTriangle,
  faList,
  faRandom,
  levellingIcon,
  searchIcon,
  sendIcon,
  undoIcon,
} from '../shell/icons';
import { querySelector } from '../shell/selectors';
import { queueAction } from '../utils/action-queue';
import {
  gatherEngramsLoadout,
  itemLevelingLoadout,
  itemMoveLoadout,
  randomLoadout,
} from './auto-loadouts';
import { applyLoadout } from './loadout-apply';
import { Loadout } from './loadout-types';
import { isMissingItems, newLoadout, newLoadoutFromEquipped } from './loadout-utils';
import styles from './LoadoutPopup.m.scss';
import {
  makeRoomForPostmaster,
  pullablePostmasterItems,
  pullFromPostmaster,
  totalPostmasterItems,
} from './postmaster';
import { loadoutsSelector, previousLoadoutSelector } from './selectors';
import { DestinyProfileResponse } from 'bungie-api-ts/destiny2';
import { unlockedItemsForCharacterOrProfilePlugSet } from 'app/records/plugset-helpers';
import { insertPlug } from 'app/inventory/advanced-write-actions';

interface ProvidedProps {
  dimStore: DimStore;
  hideFarming?: boolean;
  onClick?(e: React.MouseEvent): void;
}

interface StoreProps {
  previousLoadout?: Loadout;
  loadouts: Loadout[];
  query: string;
  stores: DimStore[];
  hasClassified: boolean;
  buckets: InventoryBuckets;
  searchFilter: ItemFilter;
  allItems: DimItem[];
  filteredItems: DimItem[];
  profileInfo?: DestinyProfileResponse;
}

type Props = ProvidedProps & StoreProps & ThunkDispatchProp;

function mapStateToProps() {
  const loadoutSortSelector = settingSelector('loadoutSort');
  const loadoutsForPlatform = createSelector(
    loadoutsSelector,
    loadoutSortSelector,
    (_state: RootState, { dimStore }: ProvidedProps) => dimStore,
    (loadouts, loadoutSort, dimStore) =>
      _.sortBy(
        loadouts.filter(
          (loadout) =>
            dimStore.classType === DestinyClass.Unknown ||
            loadout.classType === DestinyClass.Unknown ||
            loadout.classType === dimStore.classType
        ),
        loadoutSort === LoadoutSort.ByEditTime ? (l) => -(l.lastUpdatedAt ?? 0) : (l) => l.name
      )
  );

  return (state: RootState, ownProps: ProvidedProps): StoreProps => ({
    previousLoadout: previousLoadoutSelector(state, ownProps.dimStore.id),
    loadouts: loadoutsForPlatform(state, ownProps),
    query: querySelector(state),
    searchFilter: searchFilterSelector(state),
    stores: storesSelector(state),
    buckets: bucketsSelector(state)!,
    hasClassified: hasClassifiedSelector(state),
    allItems: allItemsSelector(state),
    filteredItems: filteredItemsSelector(state),
    profileInfo: profileResponseSelector(state),
  });
}

function LoadoutPopup({
  dimStore,
  hideFarming,
  stores,
  previousLoadout,
  loadouts,
  query,
  onClick,
  hasClassified,
  searchFilter,
  buckets,
  allItems,
  filteredItems,
  dispatch,
  profileInfo,
}: Props) {
  // For the most part we don't need to memoize this - this menu is destroyed when closed

  const numPostmasterItems =
    dimStore.destinyVersion === 2 ? pullablePostmasterItems(dimStore, stores).length : 0;
  const numPostmasterItemsTotal = totalPostmasterItems(dimStore);

  const makeNewLoadout = () =>
    editLoadout(newLoadout('', [], dimStore.classType), dimStore.id, { isNew: true });

  const handleNewLoadoutFromEquipped = () => {
    const loadout = newLoadoutFromEquipped('', dimStore);
    editLoadout(loadout, dimStore.id, { isNew: true });
  };

  const applySavedLoadout = (loadout: Loadout, { filterToEquipped = false } = {}) => {
    if (filterToEquipped) {
      loadout = filterLoadoutToEquipped(loadout);
    }

    dispatch(applyLoadout(dimStore, loadout, { allowUndo: true, onlyMatchingClass: true }));
  };

  // A D1 dynamic loadout set up to level weapons and armor
  const makeItemLevelingLoadout = () => {
    const loadout = itemLevelingLoadout(allItems, dimStore);
    dispatch(applyLoadout(dimStore, loadout, { allowUndo: true }));
  };

  // A D1 dynamic loadout set up to grab engrams from inventory
  const applyGatherEngramsLoadout = (options: { exotics: boolean } = { exotics: false }) => {
    let loadout;
    try {
      loadout = gatherEngramsLoadout(allItems, options);
    } catch (e) {
      showNotification({ type: 'warning', title: t('Loadouts.GatherEngrams'), body: e.message });
      return;
    }
    dispatch(applyLoadout(dimStore, loadout, { allowUndo: true }));
  };

  const applyRandomLoadout = (e: React.MouseEvent, mode = 'all') => {
    console.log('applyRandomLoadout')
    console.log('mode')
    console.log(mode)
    const weaponsOnly = mode !== 'all'
    let windowMessage = query.length > 0
    ? t('Loadouts.RandomizeSearchPrompt', { query })
    : t('Loadouts.RandomizePrompt');
    if (mode === 'weapons') {
      windowMessage = t('Loadouts.RandomizeWeapons')
    }
    if (mode === 'style') {
      windowMessage = 'Randomize your style?'
    }
    if (
      !window.confirm(windowMessage)
    ) {
      e.preventDefault();
      return;
    }
    try {
      console.log('dimStore')
      console.log(dimStore)
      console.log('allItems')
      console.log(allItems)
      console.log("weaponsOnly ? (i) => i.bucket?.sort === 'Weapons' && searchFilter(i) : searchFilter")
      console.log(weaponsOnly ? (i: any) => i.bucket?.sort === 'Weapons' && searchFilter(i) : searchFilter)
      console.log("searchFilter")
      console.log(searchFilter)
      const loadout = randomLoadout(
        dimStore,
        allItems,
        weaponsOnly ? (i) => i.bucket?.sort === 'Weapons' && searchFilter(i) : searchFilter
      );
      console.log('loadout')
      console.log(loadout)
      return;
      if (loadout) {
        dispatch(applyLoadout(dimStore, loadout, { allowUndo: true }));
      }
    } catch (e) {
      showNotification({ type: 'warning', title: t('Loadouts.Random'), body: e.message });
      return;
    }
  };

  const onInsertPlug = async (item: any, socket: any, plug: any) => {
    console.log('onInsertPlug')
    // setInsertInProgress(true);
    try {
      // console.log('item')
      // console.log(item)
      // console.log('socket')
      // console.log(socket)
      // console.log('plug')
      // console.log(plug)
      // console.log('plug.hash')
      // console.log(plug.hash)
      await dispatch(insertPlug(item, socket, plug.hash));
    } catch (e) {
      console.log('e')
      console.log(e)
      const plugName = plug.displayProperties.name ?? 'Unknown Plug';
      console.log('plugName')
      console.log(plugName)
      showNotification({
        type: 'error',
        title: t('AWA.Error'),
        body: t('AWA.ErrorMessage', { error: e.message, item: item.name, plug: plugName }),
      });
    }
  };

  const applyPlugToList = (items: DimItem[], hash: any, plugs: any, mode: string) => {
    let oneShader:any;
    let countOfItemsNotSet = 0;
    items.forEach(async  i => {
      const shaderSocket = i.sockets?.allSockets.find(s => s.plugSet?.hash === hash)
      if (shaderSocket) {
        console.log('shaderSocket', shaderSocket.plugSet?.plugs.length)
        console.log('shaderSocket.equippable', shaderSocket.plugSet?.plugs.filter(p => p.plugDef.equippable).length)
        console.log('shaderSocket.unlocked', shaderSocket.plugSet?.plugs.filter(p => plugs.includes(p.plugDef.hash)).length);
        const allUnlockedShaders = shaderSocket.plugSet?.plugs.filter(p => plugs.includes(p.plugDef.hash)) || []
        let chosenShader = allUnlockedShaders[Math.floor(Math.random()*allUnlockedShaders.length)]
        if (mode === 'same' && oneShader) {
          chosenShader = oneShader;
        }
        oneShader = chosenShader;
        await onInsertPlug(i,shaderSocket,chosenShader.plugDef)
      } else {
        countOfItemsNotSet += 1;
      }
    })
    console.log('countOfItemsNotSet', countOfItemsNotSet)
  }

  const applyRandomShader = (e: React.MouseEvent, mode = 'oneShader') => {
    if (!e) {
      console.log(e)
    }
    const equippedItems = dimStore.items.filter(i => i.equipped && (i.bucket.inWeapons || i.bucket.inArmor));
    const shaderPlugSetHash = 3841308088;
    console.log('profileInfo')
    console.log(profileInfo)

    if (!profileInfo) {
      console.log('ERROR NO PROFILE INFO');
      return;
    }
    const unlockedItems = unlockedItemsForCharacterOrProfilePlugSet(profileInfo, shaderPlugSetHash, 'valut');
    const unlockedArray = Array.from(unlockedItems)
    console.log('unlockedItems')
    console.log(unlockedItems)
    applyPlugToList(equippedItems, shaderPlugSetHash, unlockedArray, mode)
  }

  const applyRandomShaderToAll = (e: React.MouseEvent, mode = 'oneShader') => {
    if (!e) {
      console.log(e)
    }
    console.log('mode')
    console.log(mode)
    console.log('dimStore.items.length')
    console.log(dimStore.items.length)
    const someItems = allItems.filter(i => (i.bucket.inWeapons || i.bucket.inArmor));
    console.log('someItems.length')
    console.log(someItems.length)
    console.log('allItems.length')
    console.log(allItems.length)
    console.log('allItems')
    console.log(allItems)
    const shaderPlugSetHash = 3841308088;
    console.log('profileInfo')
    console.log(profileInfo)

    if (!profileInfo) {
      console.log('ERROR NO PROFILE INFO');
      return;
    }
    const unlockedItems = unlockedItemsForCharacterOrProfilePlugSet(profileInfo, shaderPlugSetHash, 'valut');
    const unlockedArray = Array.from(unlockedItems)
    console.log('unlockedItems')
    console.log(unlockedItems)
    applyPlugToList(someItems, shaderPlugSetHash, unlockedArray, mode)
  }

  // Move items matching the current search. Max 9 per type.
  const applySearchLoadout = () => {
    const loadout = itemMoveLoadout(filteredItems, dimStore);
    dispatch(applyLoadout(dimStore, loadout, { allowUndo: true }));
  };

  const doMakeRoomForPostmaster = () =>
    queueAction(() => dispatch(makeRoomForPostmaster(dimStore, buckets)));

  const doPullFromPostmaster = () => queueAction(() => dispatch(pullFromPostmaster(dimStore)));

  const onStartFarming = () => {
    dispatch(startFarming(dimStore.id));
  };

  return (
    <div className={styles.content} onClick={onClick} role="menu">
      <ul className={styles.list}>
        <li className={styles.menuItem}>
          <span onClick={makeNewLoadout}>
            <AppIcon icon={addIcon} />
            <span>{t('Loadouts.Create')}</span>
          </span>
          {!dimStore.isVault && (
            <span onClick={handleNewLoadoutFromEquipped}>{t('Loadouts.FromEquipped')}</span>
          )}
        </li>

        {query.length > 0 && (
          <li className={styles.menuItem}>
            <span onClick={applySearchLoadout}>
              <AppIcon icon={searchIcon} />
              <span>{t('Loadouts.ApplySearch', { query })}</span>
            </span>
          </li>
        )}

        {!dimStore.isVault && !hideFarming && (
          <>
            <li className={styles.menuItem}>
              <MaxlightButton
                allItems={allItems}
                dimStore={dimStore}
                hasClassified={hasClassified}
              />
            </li>

            {dimStore.destinyVersion === 1 && (
              <>
                <li className={styles.menuItem}>
                  <span onClick={makeItemLevelingLoadout}>
                    <AppIcon icon={levellingIcon} />
                    <span>{t('Loadouts.ItemLeveling')}</span>
                  </span>
                </li>

                {numPostmasterItemsTotal > 0 && (
                  <li className={styles.menuItem}>
                    <span onClick={doMakeRoomForPostmaster}>
                      <AppIcon icon={sendIcon} />
                      <span>{t('Loadouts.MakeRoom')}</span>
                    </span>
                  </li>
                )}
              </>
            )}

            {dimStore.destinyVersion === 2 && numPostmasterItems > 0 && (
              <li className={styles.menuItem}>
                <span onClick={doPullFromPostmaster}>
                  <AppIcon icon={sendIcon} />
                  <span className={styles.badge}>{numPostmasterItems}</span>{' '}
                  <span>{t('Loadouts.PullFromPostmaster')}</span>
                </span>
                <span onClick={doMakeRoomForPostmaster}>{t('Loadouts.PullMakeSpace')}</span>
              </li>
            )}
            {dimStore.destinyVersion === 2 &&
              numPostmasterItems === 0 &&
              numPostmasterItemsTotal > 0 && (
                <li className={styles.menuItem}>
                  <span onClick={doMakeRoomForPostmaster}>
                    <AppIcon icon={sendIcon} />
                    <span>{t('Loadouts.MakeRoom')}</span>
                  </span>
                </li>
              )}
            <li className={styles.menuItem}>
              <span onClick={applyRandomLoadout}>
                <AppIcon icon={faRandom} />
                <span>
                  {query.length > 0 ? t('Loadouts.RandomizeSearch') : t('Loadouts.Randomize')}
                </span>
              </span>
              {query.length === 0 && (
                <span onClick={(e) => applyRandomLoadout(e, 'weapons')}>
                  <span>{t('Loadouts.WeaponsOnly')}</span>
                </span>
              )}
            </li>
            <li className={styles.menuItem}>
              <span onClick={applyRandomShader}>
                <AppIcon icon={faRandom} />
                <span>
                  Random Shader
                </span>
              </span>
              <span onClick={(e) => applyRandomShader(e, 'same')}>
                <span>Same</span>
              </span>
            </li>
            <li className={styles.menuItem}>
              <span onClick={applyRandomShaderToAll}>
                <AppIcon icon={faRandom} />
                <span>
                  All Items Random Shader
                </span>
              </span>
              <span onClick={(e) => applyRandomShaderToAll(e, 'same')}>
                <span>Same</span>
              </span>
            </li>
            <li className={styles.menuItem}>
              <span onClick={onStartFarming}>
                <AppIcon icon={engramIcon} />
                <span>{t('FarmingMode.FarmingMode')}</span>
              </span>
            </li>
          </>
        )}

        {dimStore.destinyVersion === 1 && (
          <li className={styles.menuItem}>
            <span onClick={() => applyGatherEngramsLoadout({ exotics: true })}>
              <AppIcon icon={engramIcon} />
              <span>{t('Loadouts.GatherEngrams')}</span>
            </span>
            <span onClick={() => applyGatherEngramsLoadout({ exotics: false })}>
              <AppIcon icon={banIcon} /> <span>{t('Loadouts.GatherEngramsExceptExotics')}</span>
            </span>
          </li>
        )}

        {previousLoadout && (
          <li className={styles.menuItem}>
            <span
              title={previousLoadout.name}
              onClick={() => applySavedLoadout(previousLoadout, { filterToEquipped: true })}
            >
              <AppIcon icon={undoIcon} />
              {previousLoadout.name}
            </span>
            <span onClick={() => applySavedLoadout(previousLoadout)}>
              <span>{t('Loadouts.RestoreAllItems')}</span>
            </span>
          </li>
        )}

        <li className={styles.menuItem}>
          <Link to="../loadouts">
            <AppIcon icon={faList} />
            <span>{t('Loadouts.ManageLoadouts')}</span>
          </Link>
        </li>

        {loadouts.map((loadout) => (
          <li key={loadout.id} className={styles.menuItem}>
            <span
              title={loadout.notes ? loadout.notes : loadout.name}
              onClick={() => applySavedLoadout(loadout)}
            >
              {isMissingItems(allItems, loadout) && (
                <AppIcon
                  className={styles.warningIcon}
                  icon={faExclamationTriangle}
                  title={t('Loadouts.MissingItemsWarning')}
                />
              )}
              <ClassIcon className={styles.loadoutTypeIcon} classType={loadout.classType} />
              {loadout.name}
            </span>
            <span
              title={t('Loadouts.Edit')}
              onClick={() => editLoadout(loadout, dimStore.id, { isNew: false })}
            >
              <AppIcon icon={editIcon} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default connect<StoreProps>(mapStateToProps)(LoadoutPopup);

/**
 * Filter a loadout down to only the equipped items in the loadout.
 */
export function filterLoadoutToEquipped(loadout: Loadout) {
  return {
    ...loadout,
    items: loadout.items.filter((i) => i.equipped),
  };
}
