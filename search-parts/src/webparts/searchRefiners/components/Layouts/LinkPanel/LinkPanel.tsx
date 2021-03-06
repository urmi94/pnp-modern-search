import * as React from 'react';
import ILinkPanelProps from './ILinkPanelProps';
import ILinkPanelState from './ILinkPanelState';
import { Panel, PanelType } from 'office-ui-fabric-react/lib/Panel';
import { Label } from 'office-ui-fabric-react/lib/Label';
import * as update from 'immutability-helper';
import {
  GroupedList,
  IGroup,
  IGroupDividerProps,
  IGroupedList
} from 'office-ui-fabric-react/lib/components/GroupedList/index';
import { Link, ScrollablePane, Sticky, StickyPositionType } from 'office-ui-fabric-react';
import { ActionButton } from 'office-ui-fabric-react/lib/Button';
import styles from './LinkPanel.module.scss';
import * as strings from 'SearchRefinersWebPartStrings';
import TemplateRenderer from '../../Templates/TemplateRenderer';
import { IRefinementResult, IRefinementValue } from '../../../../../models/ISearchResult';
import IRefinerConfiguration from '../../../../../models/IRefinerConfiguration';
import IFilterLayoutProps from '../IFilterLayoutProps';
import { isEqual } from '@microsoft/sp-lodash-subset';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { Text as TextUI } from 'office-ui-fabric-react/lib/Text';
export default class LinkPanel extends React.Component<ILinkPanelProps, ILinkPanelState> {

  private _groupedList: IGroupedList;

  public constructor(props: ILinkPanelProps) {
    super(props);

    this.state = {
      showPanel: false,
      items: [],
      groups: []
    };

    this._onTogglePanel = this._onTogglePanel.bind(this);
    this._onClosePanel = this._onClosePanel.bind(this);

    this._removeAllFilters = this._removeAllFilters.bind(this);
    this._onRenderHeader = this._onRenderHeader.bind(this);
    this._onRenderCell = this._onRenderCell.bind(this);
  }

  public render(): React.ReactElement<ILinkPanelProps> {

    const renderSelectedFilterValues: JSX.Element[] = this.props.selectedFilterValues.map((value) => {

      // Get the 'display name' of the associated refiner for this value
      const configuredRefiners = this.props.refinersConfiguration.filter(refiner => { return refiner.refinerName === value.RefinementName; });
      let filterName = configuredRefiners.length === 1 ? configuredRefiners[0].displayValue : value.RefinementName;

      // Date refiner value
      if (/range\(((-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?).+\)/.test(value.RefinementToken)
          && (/(>=|<)/.test(value.RefinementValue))) {
        filterName = `[${filterName}${value.RefinementValue}"]`; // Date range template
      } else {
        filterName = `[${filterName}: "${value.RefinementValue}"]`;
      }

      return (
        <Label className={styles.filter}>
          <i className='ms-Icon ms-Icon--ClearFilter' onClick={() => {
            this._initItems(this.props, value);
            this._groupedList.forceUpdate();
          }}></i>
          {filterName}
        </Label>);
    });

    const renderAvailableFilters = <GroupedList
      ref='groupedList'
      componentRef={(g) => { this._groupedList = g; }}
      items={this.state.items}
      onRenderCell={this._onRenderCell}
      className={styles.linkPanelLayout__filterPanel__body__group}
      onShouldVirtualize={() => false}
      listProps={ { onShouldVirtualize: () => false } }
      groupProps={
        {
          onRenderHeader: this._onRenderHeader
        }
      }
      groups={this.state.groups} />;

    const renderLinkRemoveAll = this.props.hasSelectedValues ?
      (<div className={`${styles.linkPanelLayout__filterPanel__body__removeAllFilters} ${this.props.hasSelectedValues && 'hiddenLink'}`}>
        <Link onClick={this._removeAllFilters}>
          {strings.RemoveAllFiltersLabel}
        </Link>
      </div>) : null;

    return (
      <div>
        <div className={`${styles.linkPanelLayout__buttonBar__button} ms-textAlignRight`}>
          <ActionButton
            className={`${styles.linkPanelLayout__filterResultBtn} ms-fontWeight-semibold`}
            iconProps={{ iconName: 'Filter' }}
            text={strings.FilterResultsButtonLabel}
            onClick={this._onTogglePanel}
          />
        </div>
        {(this.props.selectedFilterValues.length > 0) ?

          <div className={styles.linkPanelLayout__selectedFilters}>
            {renderSelectedFilterValues}
          </div>
          : null
        }
        <Panel
          isOpen={this.state.showPanel}
          type={PanelType.medium}
          isLightDismiss={true}
          isHiddenOnDismiss={true}
          onDismiss={this._onClosePanel}
          headerText={strings.FilterPanelTitle}
          onRenderBody={() => {
            if (this.props.refinementResults.length > 0) {
              return (
                <div style={{
                  height: '100%',
                  position: 'relative',
                  maxHeight: 'inherit'
                }}>
                  <ScrollablePane styles={{
                    root: {
                      width: '100%',
                      height: '100%',
                    }
                  }}>
                  <div className={styles.linkPanelLayout__filterPanel__body} data-is-scrollable={true}>
                    {renderLinkRemoveAll}
                    {renderAvailableFilters}
                  </div>
                  </ScrollablePane>
                </div>
              );
            } else {
              return (
                <div className={styles.linkPanelLayout__filterPanel__body}>
                  {strings.NoFilterConfiguredLabel}
                </div>
              );
            }
          }}>
        </Panel>
      </div>
    );
  }

  public componentDidMount() {
    this._initGroups(this.props);
    this._initItems(this.props);
  }

  public UNSAFE_componentWillReceiveProps(nextProps: ILinkPanelProps) {
    let shouldReset = false;

    if (!isEqual(this.props.refinersConfiguration, nextProps.refinersConfiguration)) {
      shouldReset = true;
    }

    this._initGroups(nextProps, shouldReset);
    this._initItems(nextProps);

    // Need to force an update manually because nor items or groups update will be considered as an update by the GroupedList component.
    this._groupedList.forceUpdate();
  }

  private _onRenderCell(nestingDepth: number, item: any, itemIndex: number) {
    return (
      <div className={styles.linkPanelLayout__filterPanel__body__group__item} data-selection-index={itemIndex}>
        {item}
      </div>
    );
  }

  private _onRenderHeader(props: IGroupDividerProps): JSX.Element {

    return (
      <div className={styles.linkPanelLayout__filterPanel__body__group__header}
        style={props.groupIndex > 0 ? { marginTop: '10px' } : undefined}
        onClick={() => {
          props.onToggleCollapse(props.group);
        }}>
        <div className={styles.linkPanelLayout__filterPanel__body__headerIcon}>
          {props.group.isCollapsed ?
            <Icon iconName='ChevronDown' />
            :
            <Icon iconName='ChevronUp' />
          }
        </div>
        <TextUI variant={'large'}>{props.group.name}</TextUI>
      </div>
    );
  }

  private _onClosePanel() {
    this.setState({ showPanel: false });
  }

  private _onTogglePanel() {
    this.setState({ showPanel: !this.state.showPanel });
  }

  private _removeAllFilters() {
    this.props.onRemoveAllFilters();
  }

  /***
   * Initializes expanded groups
   * @param refinementResults the refinements results
   * @param refinersConfiguration the current refiners configuration
   */
  private _initGroups(props: IFilterLayoutProps, shouldResetCollapse?: boolean) {

    let groups: IGroup[] = [];
    props.refinementResults.map((refinementResult, i) => {

      // Get group name
      let groupName = refinementResult.FilterName;
      const configuredFilters = props.refinersConfiguration.filter(e => { return e.refinerName === refinementResult.FilterName; });
      groupName = configuredFilters.length > 0 && configuredFilters[0].displayValue ? configuredFilters[0].displayValue : groupName;
      let isCollapsed = true;

      // Check if the current filter is selected. If this case, we expand the group automatically
      const isFilterSelected = props.selectedFilters.filter(filter => { return filter.FilterName === refinementResult.FilterName; }).length > 0;

      const existingGroups = this.state.groups.filter(g => { return g.name === groupName; });

      if (existingGroups.length > 0 && !shouldResetCollapse) {
        isCollapsed = existingGroups[0].isCollapsed;
      } else {
        isCollapsed = (configuredFilters.length > 0 && configuredFilters[0].showExpanded) || isFilterSelected ? false : true;
      }

      let group: IGroup = {
        key: i.toString(),
        name: groupName,
        count: 1,
        startIndex: i,
        isCollapsed: isCollapsed
      };

      groups.push(group);
    });

    this.setState({
      groups: update(this.state.groups, { $set: groups })
    });
  }

  /**
   * Initializes items in for goups in the GroupedList
   * @param refinementResults the refinements results
   */
  private _initItems(props: IFilterLayoutProps, refinementValueToRemove?: IRefinementValue): void {

    let items: JSX.Element[] = [];

    // Initialize the Office UI grouped list
    props.refinementResults.map((refinementResult, i) => {

      const configuredFilter = props.refinersConfiguration.filter(e => { return e.refinerName === refinementResult.FilterName; });

      // Get selected values for this specfic refiner
      // This scenario happens due to the behavior of the Office UI Fabric GroupedList component who recreates child components when a greoup is collapsed/expanded, causing a state reset for sub components
      // In this case we use the refiners global state to recreate the 'local' state for this component
      const selectedFilter = props.selectedFilters.filter(filter => { return filter.FilterName === refinementResult.FilterName; });
      const selectedFilterValues = selectedFilter.length === 1 ? selectedFilter[0].Values : [];

      // Check if the value to remove concerns this refinement result
      let valueToRemove = null;
      if (refinementValueToRemove) {
        if (refinementResult.Values.filter(value => {
          return value.RefinementToken === refinementValueToRemove.RefinementToken || refinementResult.FilterName === refinementValueToRemove.RefinementName;
        }).length > 0
        ) {
          valueToRemove = refinementValueToRemove;
        }
      }

      items.push(
        <TemplateRenderer
          key={i}
          refinementResult={refinementResult}
          refinerConfiguration={!!configuredFilter[0] ? configuredFilter[0] : null}
          shouldResetFilters={props.shouldResetFilters}
          templateType={configuredFilter[0].template}
          valueToRemove={valueToRemove}
          onFilterValuesUpdated={props.onFilterValuesUpdated}
          language={props.language}
          themeVariant={props.themeVariant}
          selectedValues={selectedFilterValues}
          userService={this.props.userService}
          showValueFilter={configuredFilter[0].showValueFilter}
        />
      );
    });

    this.setState({
      items: update(this.state.items, { $set: items })
    });
  }
}
