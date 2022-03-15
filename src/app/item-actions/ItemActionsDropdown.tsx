import { compareFilteredItems } from 'app/compare/actions';
import Dropdown, { Option } from 'app/dim-ui/Dropdown';
import { t } from 'app/i18next-t';
import { setItemNote } from 'app/inventory/actions';
import { insertPlug } from 'app/inventory/advanced-write-actions';
import { bulkLockItems, bulkTagItems } from 'app/inventory/bulk-actions';
import { storesSortedByImportanceSelector } from 'app/inventory/selectors';
import { DimStore } from 'app/inventory/store-types';
import { itemMoveLoadout } from 'app/loadout-drawer/auto-loadouts';
import { applyLoadout } from 'app/loadout-drawer/loadout-apply';
import { unlockedItemsForCharacterOrProfilePlugSet } from 'app/records/plugset-helpers';
import { useIsPhonePortrait } from 'app/shell/selectors';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { DestinyProfileResponse } from 'bungie-api-ts/destiny2';
import React from 'react';
import { useSelector } from 'react-redux';
import { isTagValue, itemTagSelectorList, TagValue } from '../inventory/dim-item-info';
import { DimItem } from '../inventory/item-types';
import { showNotification } from '../notifications/notifications';
import {
  AppIcon,
  clearIcon,
  compareIcon,
  downloadIcon,
  lockIcon,
  stickyNoteIcon,
  unlockedIcon,
} from '../shell/icons';
import { loadingTracker } from '../shell/loading-tracker';
import styles from './ItemActionsDropdown.m.scss';

interface Props {
  searchQuery: string;
  filteredItems: DimItem[];
  searchActive: boolean;
  fixed?: boolean;
  profileInfo?: DestinyProfileResponse;
}

/**
 * Various actions that can be performed on an item
 */
export default React.memo(function ItemActionsDropdown({
  searchActive,
  filteredItems,
  searchQuery,
  fixed,
  profileInfo,
}: Props) {
  function download(filename: any, text: any) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  const dispatch = useThunkDispatch();
  const isPhonePortrait = useIsPhonePortrait();
  const stores = useSelector(storesSortedByImportanceSelector);

  let isComparable = false;
  if (filteredItems.length) {
    const type = filteredItems[0].typeName;
    isComparable = filteredItems.every((i) => i.typeName === type);
  }

  const bulkTag = loadingTracker.trackPromise(async (selectedTag: TagValue) => {
    // Bulk tagging
    const tagItems = filteredItems.filter((i) => i.taggable);

    if (isTagValue(selectedTag)) {
      dispatch(bulkTagItems(tagItems, selectedTag));
    }
  });

  const bulkLock = loadingTracker.trackPromise(async (selectedTag: TagValue) => {
    // Bulk locking/unlocking
    const state = selectedTag === 'lock';
    const lockables = filteredItems.filter((i) => i.lockable);
    dispatch(bulkLockItems(lockables, state));
  });

  const bulkNote = () => {
    const note = prompt(t('Organizer.NotePrompt'));
    if (note !== null && filteredItems.length) {
      for (const item of filteredItems) {
        dispatch(setItemNote({ itemId: item.id, note: note || undefined }));
      }
    }
  };

  const compareMatching = () => {
    dispatch(compareFilteredItems(searchQuery, filteredItems));
  };

  // Move items matching the current search. Max 9 per type.
  const applySearchLoadout = async (store: DimStore) => {
    console.log('applySearchLoadout');
    const loadout = itemMoveLoadout(filteredItems, store);
    console.log('loadout');
    console.log(loadout);
    dispatch(applyLoadout(store, loadout, { allowUndo: true }));
  };

  const bulkItemTags = itemTagSelectorList
    .filter((t) => t.type)
    .map((tag) => ({
      ...tag,
      label: t('Header.TagAs', { tag: t(tag.label) }),
    }));
  bulkItemTags.push({ type: 'clear', label: t('Tags.ClearTag'), icon: clearIcon });

  const downloadInfo = () => {
    console.log('filteredItems');
    console.log(filteredItems);
    const keys = ['name'];
    let map = filteredItems.map((i) => {
      const obj = {
        name: `${i.name}`,
        hash: `${i.hash}`,
      };

      return obj;
    });
    let file = `${keys.join(',')}\n`;
    map.forEach((m) => {
      file += `${keys.map((k) => `"${m[k]}"`).join(',')}\n`;
    });
    download('current-v2.csv', file);
  };

  const applyShaders = () => {
    // console.log('applyShaders')
    // console.log('filteredItems')
    // console.log(filteredItems)
    console.log('stores');
    console.log(stores);
    const equippedItems = filteredItems.filter((i) => i.bucket.inWeapons || i.bucket.inArmor);
    const shaderPlugSetHash = 3841308088;
    // console.log('profileInfo')
    // console.log(profileInfo)

    if (!profileInfo) {
      console.log('ERROR NO PROFILE INFO');
      return;
    }
    const unlockedItems = unlockedItemsForCharacterOrProfilePlugSet(
      profileInfo,
      shaderPlugSetHash,
      'valut'
    );
    const unlockedArray = Array.from(unlockedItems);
    // console.log('unlockedItems')
    // console.log(unlockedItems)
    applyPlugToList(equippedItems, shaderPlugSetHash, unlockedArray, 'allRandom');
  };

  const onInsertPlug = async (item: any, socket: any, plug: any) => {
    console.log('onInsertPlug');
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
      console.log('e');
      console.log(e);
      const plugName = plug.displayProperties.name ?? 'Unknown Plug';
      console.log('plugName');
      console.log(plugName);
      showNotification({
        type: 'error',
        title: t('AWA.Error'),
        body: t('AWA.ErrorMessage', { error: e.message, item: item.name, plug: plugName }),
      });
    }
  };

  const applyPlugToList = (items: DimItem[], hash: any, plugs: any, mode: string) => {
    let oneShader: any;
    let countOfItemsNotSet = 0;

    // const loadout = itemMoveLoadout(filteredItems, stores[0]);
    // console.log('loadout')
    // console.log(loadout)

    // const [getLoadoutState, setLoadoutState, stateObservable] = makeLoadoutApplyState();

    // const loadoutPromise = queueAction(() =>
    //   dispatch(
    //     doApplyLoadout(
    //       store,
    //       loadout,
    //       getLoadoutState,
    //       setLoadoutState,
    //       onlyMatchingClass,
    //       cancelToken,
    //       allowUndo
    //     )
    //   )
    // );

    // showNotification(loadoutNotification(loadout, stateObservable, loadoutPromise, cancel));

    items.forEach(async (i) => {
      const shaderSocket = i.sockets?.allSockets.find((s) => s.plugSet?.hash === hash);
      if (shaderSocket) {
        console.log('shaderSocket', shaderSocket.plugSet?.plugs.length);
        console.log(
          'shaderSocket.equippable',
          shaderSocket.plugSet?.plugs.filter((p) => p.plugDef.equippable).length
        );
        console.log(
          'shaderSocket.unlocked',
          shaderSocket.plugSet?.plugs.filter((p) => plugs.includes(p.plugDef.hash)).length
        );
        const allUnlockedShaders =
          shaderSocket.plugSet?.plugs.filter((p) => plugs.includes(p.plugDef.hash)) || [];
        let chosenShader =
          allUnlockedShaders[Math.floor(Math.random() * allUnlockedShaders.length)];
        if (mode === 'same' && oneShader) {
          chosenShader = oneShader;
        }
        oneShader = chosenShader;
        await onInsertPlug(i, shaderSocket, chosenShader.plugDef);
      } else {
        countOfItemsNotSet += 1;
      }
    });
    console.log('countOfItemsNotSet', countOfItemsNotSet);
  };

  const dropdownOptions: Option[] = [
    {
      key: 'download',
      onSelected: downloadInfo,
      content: (
        <>
          <AppIcon icon={downloadIcon} /> Download
        </>
      ),
    },
    {
      key: 'shader',
      onSelected: applyShaders,
      content: <>Apply Shaders</>,
    },
    { key: 'idk' },
    ...stores.map((store) => ({
      key: `move-${store.id}`,
      onSelected: () => applySearchLoadout(store),
      disabled: !searchActive,
      content: (
        <>
          <img src={store.icon} width="16" height="16" alt="" className={styles.storeIcon} />{' '}
          {store.isVault
            ? t('MovePopup.SendToVault')
            : t('MovePopup.StoreWithName', { character: store.name })}
        </>
      ),
    })),
    { key: 'characters' },
    {
      key: 'compare',
      onSelected: compareMatching,
      disabled: !isComparable || !searchActive,
      content: (
        <>
          <AppIcon icon={compareIcon} /> {t('Header.CompareMatching')}
        </>
      ),
    },
    {
      key: 'note',
      onSelected: () => bulkNote(),
      disabled: !searchActive,
      content: (
        <>
          <AppIcon icon={stickyNoteIcon} /> {t('Organizer.Note')}
        </>
      ),
    },
    {
      key: 'lock-item',
      onSelected: () => bulkLock('lock'),
      disabled: !searchActive,
      content: (
        <>
          <AppIcon icon={lockIcon} /> {t('Tags.LockAll')}
        </>
      ),
    },
    {
      key: 'unlock-item',
      onSelected: () => bulkLock('unlock'),
      disabled: !searchActive,
      content: (
        <>
          <AppIcon icon={unlockedIcon} /> {t('Tags.UnlockAll')}
        </>
      ),
    },
    { key: 'tags' },
    ...bulkItemTags.map((tag) => ({
      key: tag.type || 'default',
      onSelected: () => tag.type && bulkTag(tag.type),
      disabled: !searchActive,
      content: (
        <>
          {tag.icon && <AppIcon icon={tag.icon} />} {tag.label}
        </>
      ),
    })),
  ];

  return (
    <Dropdown
      options={dropdownOptions}
      kebab={true}
      className={styles.dropdownButton}
      offset={isPhonePortrait ? 10 : 3}
      fixed={fixed}
    />
  );
});
