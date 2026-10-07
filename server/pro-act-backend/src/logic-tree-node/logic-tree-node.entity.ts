import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { RCA } from '../rca/rca.entity';

@Entity('logic_tree_nodes')
export class LogicTreeNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  rcaId: string;

  @ManyToOne(() => RCA)
  @JoinColumn({ name: 'rcaId' })
  rca: RCA;

  @Column({ type: 'uuid', nullable: true })
  parentId: string;

  @ManyToOne(() => LogicTreeNode, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: LogicTreeNode;

  @OneToMany(() => LogicTreeNode, node => node.parent)
  children: LogicTreeNode[];

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // Root, Why, How, Cause

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'simple-array' })
  evidenceIds: string[];

  @Column({ type: 'text' })
  position: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 