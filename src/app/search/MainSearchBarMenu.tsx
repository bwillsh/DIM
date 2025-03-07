import { profileResponseSelector } from 'app/inventory/selectors';
import ItemActionsDropdown from 'app/item-actions/ItemActionsDropdown';
import { querySelector } from 'app/shell/selectors';
import { RootState, ThunkDispatchProp } from 'app/store/types';
import { DestinyProfileResponse } from 'bungie-api-ts/destiny2';
import { motion } from 'framer-motion';
import React from 'react';
import { connect } from 'react-redux';
import { useLocation } from 'react-router';
import { DimItem } from '../inventory/item-types';
import { filteredItemsSelector, validateQuerySelector } from './search-filter';
import './search-filter.scss';

interface StoreProps {
  searchQuery: string;
  filteredItems: DimItem[];
  showSearchCount: boolean;
  profileInfo?: DestinyProfileResponse;
}

type Props = StoreProps & ThunkDispatchProp;

function mapStateToProps(state: RootState): StoreProps {
  const searchQuery = querySelector(state);
  return {
    searchQuery,
    showSearchCount: Boolean(searchQuery && validateQuerySelector(state)(searchQuery)),
    filteredItems: filteredItemsSelector(state),
    profileInfo: profileResponseSelector(state),
  };
}

/**
 * The three-dots dropdown menu of actions for the search bar that act on searched items.
 */
function MainSearchBarMenu({ filteredItems, showSearchCount, searchQuery, profileInfo }: Props) {
  const location = useLocation();
  const onInventory = location.pathname.endsWith('inventory');

  const showSearchActions = onInventory;
  if (!showSearchActions) {
    return null;
  }

  return (
    <motion.div
      layout
      key="action"
      exit={{ scale: 0 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
    >
      <ItemActionsDropdown
        filteredItems={filteredItems}
        searchActive={showSearchCount}
        searchQuery={searchQuery}
        fixed={true}
        profileInfo={profileInfo}
      />
    </motion.div>
  );
}

export default connect<StoreProps>(mapStateToProps)(MainSearchBarMenu);
